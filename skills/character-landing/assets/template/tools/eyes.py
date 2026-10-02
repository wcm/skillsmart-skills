# Find eye candidates on a character's first turnaround frame: compact dark or bright blobs inside the figure.
# Prints them as fractions of the frame, ready to paste into character.json "eyes" after a quick sanity check.
#   python3 eyes.py <id> [--mode dark|bright] [--min 40] [--max 4000] [--debug out.png]
import sys, json, argparse
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("id")
ap.add_argument("--mode", default="dark")
ap.add_argument("--min", type=int, default=40)
ap.add_argument("--max", type=int, default=4000)
ap.add_argument("--thresh", type=int, default=None)
ap.add_argument("--debug")
a = ap.parse_args()

im = Image.open(f"../site/characters/{a.id}/seq/0001.webp").convert("RGBA")
arr = np.asarray(im).astype(np.float32)
W, H = im.size
lum = arr[..., :3].mean(axis=2)
inside = ndimage.binary_erosion(arr[..., 3] > 200, iterations=6)
t = a.thresh if a.thresh is not None else (55 if a.mode == "dark" else 225)
mask = inside & ((lum < t) if a.mode == "dark" else (lum > t))
mask = ndimage.binary_opening(mask, iterations=1)
lab, n = ndimage.label(mask)
out = []
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    area = int((lab[sl] == i).sum())
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    fill = area / (w * h)
    if not (a.min <= area <= a.max) or fill < .55 or max(w, h) / max(1, min(w, h)) > 2.4:
        continue
    cy, cx = ndimage.center_of_mass(lab == i)
    out.append({"x": round(cx / W, 4), "y": round(cy / H, 4), "rx": round(w / 2 / W, 4), "ry": round(h / 2 / H, 4), "area": area})
out.sort(key=lambda e: (e["y"], e["x"]))
print(json.dumps(out, indent=1))
if a.debug:
    d = ImageDraw.Draw(im)
    for e in out:
        x, y, rx, ry = e["x"] * W, e["y"] * H, e["rx"] * W, e["ry"] * H
        d.ellipse([x - rx - 3, y - ry - 3, x + rx + 3, y + ry + 3], outline=(255, 0, 80, 255), width=2)
    im.save(a.debug)
