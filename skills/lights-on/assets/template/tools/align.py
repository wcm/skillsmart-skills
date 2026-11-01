"""Line up a night (or variant) picture with its day picture, and measure how well they match.

    .venv/bin/python align.py day.png night.png                 report only
    .venv/bin/python align.py day.png night.png --out a.png     also write night warped onto day's frame (day's size)
    .venv/bin/python align.py day.png night.png --sheet s.jpg   a review sheet: edges of both, before and after

Lighting differs a lot between the two, so both are matched on normalised gradients (edges), not on brightness.
The global fit is affine (ECC, coarse to fine). What's left after it is measured with dense optical flow on the
edges: p50/p95 local drift in pixels at the day picture's size. Under ~2 px p95 the two blend without ghosting.
"""
import argparse
import json
import sys

import cv2
import numpy as np


def load(path, size=None):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        sys.exit(f"cannot read {path}")
    if size is not None and (img.shape[1], img.shape[0]) != size:
        img = cv2.resize(img, size, interpolation=cv2.INTER_AREA)
    return img


def edges(img, scale):
    """normalised gradient magnitude, float32 in 0..1, at `scale` of the input"""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    if scale != 1:
        g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    g = np.log1p(g * 40.0)  # compress: dark night detail counts as much as bright day detail
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    m = np.sqrt(gx * gx + gy * gy)
    local = cv2.GaussianBlur(m, (0, 0), 12) + 1e-3
    m = m / local  # local contrast normalisation
    m = cv2.GaussianBlur(m, (0, 0), 1.5)
    return np.clip(m / (np.percentile(m, 99.5) + 1e-6), 0, 1).astype(np.float32)


def fit(ref, img):
    """affine warp (2×3, in full-res px of ref) mapping ref coords → img coords"""
    h, w = ref.shape[:2]
    warp = np.eye(2, 3, dtype=np.float32)
    # img is first resized to ref's size, so identity is the right start
    for scale in (0.125, 0.25, 0.5):
        a, b = edges(ref, scale), edges(img, scale)
        wscaled = warp.copy()
        wscaled[:, 2] *= scale
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        try:
            _, wscaled = cv2.findTransformECC(a, b, wscaled, cv2.MOTION_AFFINE, crit, None, 5)
        except cv2.error:
            pass
        warp = wscaled.copy()
        warp[:, 2] /= scale
    return warp


def drift(ref, img, scale=0.5):
    """dense flow between the edge maps → p50, p95 displacement (full-res px) and the flow field"""
    a = (edges(ref, scale) * 255).astype(np.uint8)
    b = (edges(img, scale) * 255).astype(np.uint8)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flow = dis.calc(a, b, None)
    mag = np.sqrt((flow ** 2).sum(-1)) / scale
    # ignore flat areas, where flow is meaningless
    mask = cv2.dilate((a > 40).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    vals = mag[mask] if mask.any() else mag.ravel()
    return float(np.percentile(vals, 50)), float(np.percentile(vals, 95)), mag


def ncc(ref, img, scale=0.25):
    a, b = edges(ref, scale), edges(img, scale)
    a, b = a - a.mean(), b - b.mean()
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("ref")
    p.add_argument("img")
    p.add_argument("--out")
    p.add_argument("--sheet")
    p.add_argument("--no-warp", action="store_true", help="measure only, as delivered")
    args = p.parse_args()

    ref = load(args.ref)
    h, w = ref.shape[:2]
    raw = load(args.img)
    src_size = (raw.shape[1], raw.shape[0])
    img = cv2.resize(raw, (w, h), interpolation=cv2.INTER_AREA) if src_size != (w, h) else raw

    before = {"ncc": ncc(ref, img)}
    before["p50"], before["p95"], _ = drift(ref, img)

    warp = np.eye(2, 3, dtype=np.float32) if args.no_warp else fit(ref, img)
    aligned = cv2.warpAffine(img, warp, (w, h), flags=cv2.INTER_LANCZOS4 + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    after = {"ncc": ncc(ref, aligned)}
    after["p50"], after["p95"], mag = drift(ref, aligned)

    sx = float(np.hypot(warp[0, 0], warp[1, 0]))
    sy = float(np.hypot(warp[0, 1], warp[1, 1]))
    rot = float(np.degrees(np.arctan2(warp[1, 0], warp[0, 0])))
    report = {
        "ref": args.ref, "img": args.img, "img_size": src_size, "ref_size": (w, h),
        "warp": {"tx": round(float(warp[0, 2]), 2), "ty": round(float(warp[1, 2]), 2), "sx": round(sx, 5), "sy": round(sy, 5), "rot_deg": round(rot, 4)},
        "before": {k: round(v, 3) for k, v in before.items()},
        "after": {k: round(v, 3) for k, v in after.items()},
    }
    print(json.dumps(report))

    if args.out:
        cv2.imwrite(args.out, aligned, [cv2.IMWRITE_PNG_COMPRESSION, 3])

    if args.sheet:
        sw = 1280
        sh = int(h * sw / w)
        def small(x):
            return cv2.resize(x, (sw, sh), interpolation=cv2.INTER_AREA)
        e_ref = edges(ref, sw / w)
        e_before = edges(img, sw / w)
        e_after = edges(aligned, sw / w)
        def overlay(a, b):  # ref edges red, other cyan; grey/white where they agree
            o = np.zeros((sh, sw, 3), np.float32)
            o[..., 2] = a
            o[..., 1] = b
            o[..., 0] = b
            return (np.clip(o * 1.6, 0, 1) * 255).astype(np.uint8)
        heat = cv2.applyColorMap(np.clip(cv2.resize(mag, (sw, sh)) * 25, 0, 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
        top = np.hstack([small(ref), small(aligned)])
        bottom = np.hstack([overlay(e_ref, e_before), overlay(e_ref, e_after)])
        sheet = np.vstack([top, bottom, np.hstack([heat, cv2.addWeighted(small(ref), 0.5, small(aligned), 0.5, 0)])])
        cv2.imwrite(args.sheet, sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])


if __name__ == "__main__":
    main()
