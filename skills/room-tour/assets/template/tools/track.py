#!/usr/bin/env python3
# Needs OpenCV: python3 -m pip install opencv-python-headless numpy (once).
# Follows named points through a tour clip, so a label can ride on an object while the camera walks (a tracked tag,
# references/engine.md). Lucas–Kanade optical flow (OpenCV, pyramidal) from a seed point, run forwards from
# the seed frame to the clip's end, then backwards from the seed to frame 0. Every step is checked by tracking the
# point back again: the forward–backward error gives the quality q (1 under 0.5 px, 0 over 3 px, linear between).
# A point that leaves the frame, fails to track, or drifts badly (an error over 6 px, or three steps in a row over 3
# px) is lost from there on: null in the file, and the page hides its tag.
#
#   python3 track.py out/<id>/move-2.mp4 ../site/<id>/tracks/move-2.json --point coping=1210,804
#   python3 track.py clip.mp4 out.json --point coping=0.63,0.74            fractions of the frame also work
#   python3 track.py clip.mp4 out.json --point rail=880,610@120            seed on source frame 120 (@last: the last frame)
#   python3 track.py clip.mp4 out.json --point a=…  --point b=…  --smooth 1  two points, lightly smoothed
#   python3 track.py clip.mp4 out.json --point c=… --merge                 add or replace c in an existing file
#
# Seed on stable texture (a stone joint, a corner, a fitting), never on water, glass, a reflection or a plain wall.
#
# tracks file: { size: [W, H], fps, count, points: { name: [[x, y, q] | null per SOURCE frame] },
# seeds: { name: [x, y, frame] } }. x, y in clip pixels. One file per clip; the page finds a web frame's source frame
# in the frame set's manifest.json `map`.
#
# Options: --snap 10 (the seed moves to the strongest corner within 10 px; 0 keeps it exactly), --win 21 (the LK
# window, px at the clip's size), --levels 3 (pyramid levels), --smooth N (a centred moving
# average over 2N + 1 frames inside each tracked run; default 0, off), --scale 1 (track on frames scaled by this, e.g.
# 0.5 for speed; coordinates are written at the clip's size either way).
import argparse, json, os, sys
import numpy as np, cv2

ap = argparse.ArgumentParser(description="Follow named points through a clip (Lucas–Kanade, forwards and backwards from the seed).")
ap.add_argument("clip")
ap.add_argument("out")
ap.add_argument("--point", action="append", required=True, help="name=x,y[@frame|@last]: clip pixels, or fractions when both are ≤ 1")
ap.add_argument("--win", type=int, default=21)
ap.add_argument("--levels", type=int, default=3)
ap.add_argument("--smooth", type=int, default=0)
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--snap", type=float, default=10, help="move the seed to the strongest corner within this many px (0: keep it)")
ap.add_argument("--merge", action="store_true", help="keep the other points already in out")
args = ap.parse_args()

cap = cv2.VideoCapture(args.clip)
fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
grey = []
W0 = H0 = None
while True:
    ok, f = cap.read()
    if not ok: break
    H0, W0 = f.shape[:2]
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    if args.scale != 1: g = cv2.resize(g, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_AREA)
    grey.append(g)
n = len(grey)
if not n: sys.exit(f"no frames in {args.clip}")
S = args.scale
H1, W1 = grey[0].shape[:2]
win = max(7, int(round(args.win * S)) | 1)
lk = dict(winSize=(win, win), maxLevel=args.levels, criteria=(cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 40, 0.01))
margin = win / 2

def parse(spec):
    if "=" not in spec: sys.exit(f"--point {spec}: expected name=x,y[@frame]")
    name, rest = spec.split("=", 1)
    frame = 0
    if "@" in rest: rest, fr = rest.split("@", 1); frame = n - 1 if fr == "last" else int(fr)
    x, y = (float(v) for v in rest.split(","))
    if x <= 1 and y <= 1: x, y = x * W0, y * H0
    if not (0 <= frame < n): sys.exit(f"--point {name}: frame {frame} is outside 0–{n - 1}")
    return name.strip(), x, y, frame

def q_of(fb):
    return float(np.clip((3.0 - fb) / 2.5, 0.0, 1.0))

def run(p0, a, step):
    """track from frame a in direction step (+1 / -1); returns {frame: (x, y, q)} (scaled coordinates)"""
    out = {}
    p = np.array([[p0]], np.float32)
    bad = 0
    i = a
    while 0 <= i + step < n:
        j = i + step
        p1, st, _ = cv2.calcOpticalFlowPyrLK(grey[i], grey[j], p, None, **lk)
        if p1 is None or not st[0][0]: break
        back, st2, _ = cv2.calcOpticalFlowPyrLK(grey[j], grey[i], p1, None, **lk)
        if back is None or not st2[0][0]: break
        fb = float(np.linalg.norm(back[0][0] - p[0][0])) / S
        x, y = p1[0][0]
        if not (margin <= x < W1 - margin and margin <= y < H1 - margin): break
        if fb > 6: break
        bad = bad + 1 if fb > 3 else 0
        if bad >= 3: break
        out[j] = (float(x), float(y), q_of(fb))
        p = p1
        i = j
    return out

def smooth(track, k):
    if k <= 0: return track
    out = list(track)
    runs, cur = [], []
    for i, v in enumerate(track):
        if v is None:
            if cur: runs.append(cur); cur = []
        else: cur.append(i)
    if cur: runs.append(cur)
    for r in runs:
        for idx, i in enumerate(r):
            lo, hi = max(0, idx - k), min(len(r), idx + k + 1)
            xs = [track[r[m]][0] for m in range(lo, hi)]
            ys = [track[r[m]][1] for m in range(lo, hi)]
            out[i] = [sum(xs) / len(xs), sum(ys) / len(ys), track[i][2]]
    return out

points, seeds = {}, {}
if args.merge and os.path.exists(args.out):
    prev = json.load(open(args.out))
    if prev.get("count") == n:
        points.update(prev.get("points", {}))
        seeds.update(prev.get("seeds", {}))
    else:
        print(f"{args.out} has {prev.get('count')} frames, the clip {n}: not merging", file=sys.stderr)

for spec in args.point:
    name, x, y, a = parse(spec)
    # a seed on a corner tracks best: snap it to the strongest corner within --snap px (an edge or a row of bars would
    # let the point slide along them), then refine it to sub-pixel
    seed = np.array([[[x * S, y * S]]], np.float32)
    R = int(round(args.snap * S))
    if R > 0:
        x0, y0 = int(max(0, x * S - R)), int(max(0, y * S - R))
        roi = grey[a][y0:int(min(H1, y * S + R + 1)), x0:int(min(W1, x * S + R + 1))]
        c = cv2.goodFeaturesToTrack(roi, maxCorners=1, qualityLevel=0.05, minDistance=1, blockSize=5)
        if c is not None: seed = np.array([[[c[0][0][0] + x0, c[0][0][1] + y0]]], np.float32)
    try:
        cv2.cornerSubPix(grey[a], seed, (3, 3), (-1, -1), (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 20, 0.03))
    except cv2.error:
        pass
    sx, sy = seed[0][0]
    track = [None] * n
    track[a] = [float(sx), float(sy), 1.0]
    for j, v in {**run((sx, sy), a, +1), **run((sx, sy), a, -1)}.items(): track[j] = list(v)
    track = smooth(track, args.smooth)
    track = [None if v is None else [round(v[0] / S, 2), round(v[1] / S, 2), round(v[2], 3)] for v in track]
    points[name] = track
    seeds[name] = [round(float(sx) / S, 2), round(float(sy) / S, 2), a]
    got = [v for v in track if v]
    qs = [v[2] for v in got]
    first = next(i for i, v in enumerate(track) if v)
    last = n - 1 - next(i for i, v in enumerate(reversed(track)) if v)
    print(f"{name}: seed ({seeds[name][0]}, {seeds[name][1]}) @ {a}; tracked frames {first}–{last} ({len(got)} of {n}), "
          f"q mean {np.mean(qs):.2f}, min {min(qs):.2f}, {sum(q >= 0.6 for q in qs)} frames with q ≥ 0.6")

os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
with open(args.out, "w") as fh:
    json.dump({"size": [W0, H0], "fps": round(fps, 3), "count": n, "points": points, "seeds": seeds}, fh, separators=(",", ":"))
print("wrote", args.out)
