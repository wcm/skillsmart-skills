"""Get a scene's pictures ready for the page: line every shot up with the day photo, measure each light's share of
the night light from the photos of that light on its own, and write the web sizes.

    .venv/bin/python prep.py <id>            → ../site/<id>/img/<shot>-<w>.webp, weights0.png, scene.json
    .venv/bin/python prep.py <id> --no-align   skip the fit (use the edits as delivered)

Reads tools/out/<id>/<shot>.png and tools/scenes/<id>.json ("solos": which shots are lights, in channel order). A shot is fitted
to the day photo only if the fit really helps (edge correlation goes up and the move is small); scene.json records
what was done, each light's measured centre (for hotspots) and the picture size.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from align import drift, fit, ncc  # noqa: E402

TOOLS = os.path.dirname(os.path.abspath(__file__))
WIDTHS = [1600, 2400, 3200]


def lin(img):
    x = img.astype(np.float32) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lum(img_bgr_lin):
    return 0.0722 * img_bgr_lin[..., 0] + 0.7152 * img_bgr_lin[..., 1] + 0.2126 * img_bgr_lin[..., 2]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("scene")
    p.add_argument("--no-align", action="store_true")
    p.add_argument("--quality", type=int, default=86)
    args = p.parse_args()

    src = os.path.join(TOOLS, "out", args.scene)
    dst = os.path.join(TOOLS, "..", "site", args.scene, "img")
    os.makedirs(dst, exist_ok=True)
    os.makedirs(os.path.join(src, "aligned"), exist_ok=True)
    scene = json.load(open(os.path.join(TOOLS, "scenes", f"{args.scene}.json")))
    spec = scene["shots"]
    lights = {"solos": scene.get("solos")}

    day = cv2.imread(os.path.join(src, "day.png"), cv2.IMREAD_COLOR)
    h, w = day.shape[:2]
    meta = {"width": w, "height": h, "shots": {}, "lights": []}
    pics = {"day": day}

    for shot in spec:
        if shot == "day":
            continue
        path = os.path.join(src, f"{shot}.png")
        if not os.path.exists(path):
            print(f"  {shot}: missing, skipped")
            continue
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if (img.shape[1], img.shape[0]) != (w, h):
            img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
        # fit to the day photo, or to the photo it was edited from when that one is not a day photo of a fabric
        ref = day if not shot.startswith(("night-", "dark-")) else pics.get("day-" + shot.split("-", 1)[1], day)
        rec = {"ncc_before": round(ncc(ref, img), 4)}
        if not args.no_align:
            warp = fit(ref, img)
            moved = abs(warp[0, 2]) + abs(warp[1, 2]) + abs(warp[0, 0] - 1) * w + abs(warp[1, 1] - 1) * h
            warped = cv2.warpAffine(img, warp, (w, h), flags=cv2.INTER_LANCZOS4 + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
            after = ncc(ref, warped)
            rec.update({"ncc_after": round(after, 4), "moved_px": round(float(moved), 2)})
            if after > rec["ncc_before"] + 0.0005 and moved < 40:
                img = warped
                rec["fitted"] = True
        _, p95, _ = drift(ref, img)
        rec["drift_p95"] = round(p95, 2)
        pics[shot] = img
        cv2.imwrite(os.path.join(src, "aligned", f"{shot}.png"), img, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        meta["shots"][shot] = rec
        print(f"  {shot}: {rec}")

    # light shares: D_i = what light i adds over the dark photo; f_i = D_i / sum(D), smoothed, in RGBA channels
    if lights.get("solos") and "dark" in pics and "night" in pics:
        ww = 960
        hh = round(h * ww / w)
        small = lambda im: cv2.resize(im, (ww, hh), interpolation=cv2.INTER_AREA)
        dark = lum(lin(small(pics["dark"])))
        night = lum(lin(small(pics["night"])))
        total = np.maximum(night - dark, 0)
        d = []
        for name in lights["solos"]:
            if name == "rest":
                d.append(None)
                continue
            d.append(np.maximum(lum(lin(small(pics[f"solo-{name}"]))) - dark, 0))
        if any(x is None for x in d):
            known = sum(x for x in d if x is not None)
            d = [np.maximum(total - known, 0) if x is None else x for x in d]
        # where each light is: the brightest point of what it adds (the shade or tube itself glows far brighter
        # than the pool it throws), and the box round everything above a third of that
        for name, x in zip(lights["solos"], d):
            fine = cv2.GaussianBlur(x, (0, 0), ww * 0.004)
            yy, xx = np.unravel_index(int(np.argmax(fine)), fine.shape)
            ys, xs = np.nonzero(fine >= fine.max() * 0.33)
            meta["lights"].append({
                "id": name, "x": round(float(xx) / ww, 4), "y": round(float(yy) / hh, 4),
                "box": [round(float(xs.min()) / ww, 4), round(float(ys.min()) / hh, 4), round(float(xs.max()) / ww, 4), round(float(ys.max()) / hh, 4)],
            })
        sigma = ww * 0.012
        d = [cv2.GaussianBlur(x, (0, 0), sigma) for x in d]
        s = sum(d)
        floor = np.percentile(s, 99) * 0.03
        shares = [x / np.maximum(s, floor) for x in d]
        # three lights per opaque RGB picture (browsers may drop colour under zero alpha, so no alpha channel)
        for k in range(0, len(shares), 3):
            chans = shares[k:k + 3] + [np.zeros_like(dark)] * (3 - len(shares[k:k + 3]))
            bgr = np.stack([chans[2], chans[1], chans[0]], -1)
            cv2.imwrite(os.path.join(dst, f"weights{k // 3}.png"), np.clip(bgr * 255 + 0.5, 0, 255).astype(np.uint8))
        print("  lights:", meta["lights"])

    for shot, img in pics.items():
        for width in WIDTHS:
            if width > w:
                continue
            out = cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(dst, f"{shot}-{width}.webp"), out, [cv2.IMWRITE_WEBP_QUALITY, args.quality])
    json.dump(meta, open(os.path.join(dst, "scene.json"), "w"), indent=2)
    print(f"{args.scene}: {len(pics)} pictures → {os.path.relpath(dst)}")


if __name__ == "__main__":
    main()
