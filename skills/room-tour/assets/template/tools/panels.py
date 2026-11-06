#!/usr/bin/env python3
# Needs OpenCV: python3 -m pip install opencv-python-headless numpy (once).
# Finds the blank chroma-green canvases in a tour clip and follows their four corners through every frame, so the
# page can lay the real artworks onto them. A canvas in full view gets its corners from its outline (straight edges
# fitted to the green area's border). A canvas partly out of frame is carried along by the wall around it (optical
# flow on the frame edge and the wall, a homography per frame), then snapped to the edges that are still in view.
# A canvas partly hidden by something in front of it (a door jamb, a bench) is carried by the wall alone, so it keeps
# its whole shape instead of being squeezed into its visible part.
#
#   python3 panels.py out/<id>/move-1.mp4                     → move-1.panels.json beside the clip
#   python3 panels.py … --proof art.png                           also move-1-proof.mp4: art on every canvas
#   python3 panels.py … --min-area 0.0003                         also find small canvases far away
#
# panels.json: { size: [W, H], fps, count, panels: [{ id, quads: [[x0,y0,x1,y1,x2,y2,x3,y3] | null per frame],
# full: [bool per frame], medians: [grey | null per frame] }] }
# Corners go top-left, top-right, bottom-right, bottom-left, in pixels of the clip. id 0 is the leftmost canvas in
# the first frame where it shows. full: the canvas is wholly in view in that frame (off the image border and not
# covered); otherwise its quad came from the wall's motion. medians: the median grey of the canvas's keyed pixels
# inside its quad, in the same units as the grey light map `frames.mjs --key` writes (0.92 × (0.25 R + 0.6 G + 0.15 B)),
# so the page can normalise the light map by the stop frame's value.
#
# How it decides:
# - Part-hidden canvases. A canvas is full only if its blob is off the image border, every edge of it shows its dark
#   frame (an edge of green with only a pale object beside it — a jamb, the bench — is covered) and it covers
#   ≥ 0.9 × the area the wall homography predicts. When a matched canvas is covered (a covered edge, or less than
#   0.9 × the predicted in-image area), its quad is its shape from the last frame where it was whole, placed by a
#   similarity on its solid corners (both edges framed) read off this frame's blob, refitted only on framed edges
#   that show ≥ 60 % of their length (full = false), never the squeezed blob; with no solid corner, the wall's
#   prediction refitted on the framed edges. The edge test is there because the area test alone can't see a jamb
#   that slides in a little each frame (each prediction would already be squeezed). Where the two passes disagree
#   by more than 10 % in visible area, the larger quad wins, but a pass that hasn't yet seen the canvas whole never
#   wins over one that has. Forward-only tracks that are never full are dropped, like backward-only ones; a canvas
#   followed twice is merged into the copy seen whole more often (the other fills its gaps). Matching also takes the
#   nearest blob of a similar size (a small canvas beside a jamb pulls the wall's flow off) and a covered sliver
#   lying wholly inside the predicted quad. Canvases on one wall can fill each other's covered frames (a partner's
#   wall mapping, when it holds to 2.5 px). Last, a quad that isn't whole is dropped (null: the page holds the last
#   good one briefly) if it is not convex, flies far off the image, shows < 3 % green (a canvas wholly behind a
#   jamb gets no quad, so no label claims it), or, inside the image, changes its edges by > 15 % from the last good
#   quad or its area beyond 0.5–2 × its whole size. Tracks under 3 frames are dropped.
# - Canvases cut by the image border: an edge with too few points is pushed out to hold the visible blob, so no strip
#   of canvas is left uncovered at the border. The 5-frame corner smoothing uses centred windows only, so corners
#   don't lag at the end of a track or beside a gap. Small canvases' edges are refitted from 10 points.
# - --min-area (default 0.002 of the frame): pass 0.0003 so a 60 × 45 cm work in the next room is found.
# - The console prints each canvas's centre in its first visible frame; the --proof video draws each panel's id at
#   its quad centre (a trailing "~" where the quad came from the wall, not the outline) and lays the art only where
#   the canvas's green shows (the key, dilated 2 px), like the page does with the canvas mask, so anything in front
#   of a canvas stays in front.
import argparse, json, subprocess
import numpy as np, cv2

ap = argparse.ArgumentParser()
ap.add_argument("clip")
ap.add_argument("--proof", help="a picture to paste on every canvas, for a proof video")
ap.add_argument("--out")
ap.add_argument("--min-area", type=float, default=0.002, help="smallest canvas, as a fraction of the frame (0.0003 finds a 60 × 45 cm work across two rooms)")
args = ap.parse_args()

cap = cv2.VideoCapture(args.clip)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
H_, W_ = frames[0].shape[:2]
N = len(frames)
IMG = np.array([[0, 0], [W_, 0], [W_, H_], [0, H_]], np.float32)

def key_mask(f):
    b, g, r = [c.astype(np.int16) for c in cv2.split(f)]
    m = (((g - np.maximum(r, b)) > 45) & (g > 70)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

def order(q):
    s, d = q.sum(1), q[:, 1] - q[:, 0]
    return np.array([q[np.argmin(s)], q[np.argmin(d)], q[np.argmax(s)], q[np.argmax(d)]], np.float64)

def on_border(p, m=3):
    return (p[:, 0] <= m) | (p[:, 0] >= W_ - 1 - m) | (p[:, 1] <= m) | (p[:, 1] >= H_ - 1 - m)

def line_fit(pts):
    vx, vy, x0, y0 = cv2.fitLine(pts.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
    return np.array([x0, y0]), np.array([vx, vy])

def intersect(l1, l2):
    (p, r), (q, s) = l1, l2
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9: return None
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
    return p + t * r

def snap(quad, contour, tol=10, keep=(False, False, False, False), contain=False):
    """Refits each edge of quad to the contour points near it that aren't on the image border; an edge with too
    few such points, or flagged in keep, keeps its line from quad (with contain, moved out just enough that the
    quad holds the whole visible blob: a canvas coming out from behind a jamb only ever grows). Returns the corners
    where the lines meet."""
    pts = contour.reshape(-1, 2).astype(np.float64)
    allp = pts
    pts = pts[~on_border(pts)]
    lines = []
    c = quad.mean(axis=0)
    for k in range(4):
        a, b = quad[k], quad[(k + 1) % 4]
        if keep[k]:
            u = (b - a) / np.linalg.norm(b - a)
            if contain and len(allp):
                n = np.array([-u[1], u[0]])
                if (c - a) @ n > 0: n = -n  # outward
                out = (allp - a) @ n
                if out.max() > 1.5: a = a + n * np.percentile(out, 99.5)
            lines.append((a, u)); continue
        d = b - a; L = np.linalg.norm(d); u = d / L; n = np.array([-u[1], u[0]])
        rel = pts - a
        along, off = rel @ u, rel @ n
        near = (np.abs(off) < tol) & (along > 0.06 * L) & (along < 0.94 * L)
        if near.sum() >= max(10, min(25, int(0.5 * L))): lines.append(line_fit(pts[near])); continue
        if contain and len(allp):
            # an edge off the image or with too few points: moved out just enough to hold the visible blob, so no
            # strip of canvas is left uncovered at the image border
            nn = n if (c - a) @ n <= 0 else -n
            o = (allp - a) @ nn
            if o.max() > 1.5: a = a + nn * np.percentile(o, 99.5)
        lines.append((a, u))
    out = [intersect(lines[(k - 1) % 4], lines[k]) for k in range(4)]
    return quad if any(c is None for c in out) else np.array(out)

def visible_area(q):
    """The area of quad q that lies inside the image."""
    try:
        a, _ = cv2.intersectConvexConvex(q.astype(np.float32), IMG)
        return float(a)
    except cv2.error:
        m = np.zeros((H_, W_), np.uint8); cv2.fillPoly(m, [np.round(q).astype(np.int32)], 1)
        return float(m.sum())

def covered_edges(quad, contour, gray, tol=10, ratio=0.88):
    """Each of the quad's four edges: "f" (framed: the canvas's own edge), "c" (covered by something in front) or
    None (on the image border, or too few points to tell). Every canvas sits in a dark frame, so just outside a true
    edge of the green, within 6 px, there is a pixel clearly darker than the green itself (≤ 0.83 × its grey even on
    a 40 px canvas two rooms away, ≈ 0.3 × up close); outside an edge cut by a jamb or a bench there is only that
    pale object and the anti-aliased step to it (≥ 0.92 ×). Measured on the gallery's move-1."""
    pts = contour.reshape(-1, 2).astype(np.float64)
    pts = pts[~on_border(pts)]
    c = quad.mean(axis=0)
    out = []
    for k in range(4):
        a, b = quad[k], quad[(k + 1) % 4]
        d = b - a; L = np.linalg.norm(d); u = d / L; n = np.array([-u[1], u[0]])
        if (c - a) @ n > 0: n = -n  # outward
        rel = pts - a
        near = (np.abs(rel @ n) < tol) & (rel @ u > 0.1 * L) & (rel @ u < 0.9 * L)
        if near.sum() < 8: out.append(None); continue
        p = pts[near]
        def sample(step):
            q = np.round(p + n * step).astype(int)
            q[:, 0] = q[:, 0].clip(0, W_ - 1); q[:, 1] = q[:, 1].clip(0, H_ - 1)
            return gray[q[:, 1], q[:, 0]].astype(np.float64)
        outside = np.median(np.min([sample(s) for s in range(1, 7)], axis=0))
        inside = np.median([sample(-s) for s in (3, 4)])
        out.append("c" if outside > ratio * max(inside, 1) else "f")
    return out

def carry(prev, base, qb, contour, st, anchor=None):
    """A covered canvas's quad for this frame: prev (last frame's whole shape) moved by a similarity fitted on its
    solid corners (both edges framed), read off this frame's blob itself (qb, the blob's own quad, refitted on its
    framed edges: those are the canvas's true edges); with one solid corner, moved by it; with none, base (the wall's
    prediction). Then the framed edges are refitted and the covered ones pushed out to hold the blob. The wall's flow
    is only the last resort here: its features include the jamb's, which moves otherwise."""
    keep = [s != "f" for s in st]
    fit = snap(qb, contour, keep=keep)
    solid = [k for k in range(4) if st[(k - 1) % 4] == "f" and st[k] == "f"]
    if len(solid) >= 2:
        # the shape comes from the last frame where the canvas was whole (anchor), not from last frame's carried
        # quad, so small errors don't pile up frame after frame
        src = anchor if anchor is not None else prev
        pairs = [(a, b) for a in solid for b in solid if a < b]
        s0, s1 = max(pairs, key=lambda ab: np.linalg.norm(src[ab[0]] - src[ab[1]]))
        a0, a1 = complex(*src[s0]), complex(*src[s1])
        b0, b1 = complex(*fit[s0]), complex(*fit[s1])
        if abs(a1 - a0) > 1:
            m = (b1 - b0) / (a1 - a0)
            if 0.8 < abs(m) < 1.25:
                z = [m * (complex(*c) - a0) + b0 for c in src]
                base = np.array([[v.real, v.imag] for v in z])
    elif len(solid) == 1:
        base = prev + (fit[solid[0]] - prev[solid[0]])
    else:
        # no solid corner: the flow may have drifted, look further for the framed edges
        return snap(base, contour, tol=25, keep=keep, contain=True)
    # placed on its solid corners: refit a framed edge only where the blob shows ≥ 60 % of its length (a short framed
    # edge beside a jamb would tilt a refitted line); the rest keep the carried shape, pushed out where the blob pokes
    # past it
    pts = contour.reshape(-1, 2).astype(np.float64); pts = pts[~on_border(pts)]
    keep = list(keep)
    for k in range(4):
        if keep[k]: continue
        a, b = base[k], base[(k + 1) % 4]; d = b - a; L = np.linalg.norm(d); u = d / L; nrm = np.array([-u[1], u[0]])
        rel = pts - a; near = np.abs(rel @ nrm) < 10
        if near.sum() < 2 or np.ptp(rel[near] @ u) < 0.6 * L: keep[k] = True
    return snap(base, contour, keep=keep, contain=True)

def detect(mask, gray):
    """Every canvas in a key mask: (quad, contour, off_border, area in pixels, covered edges)."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    found = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < args.min_area * W_ * H_: continue
        comp = (lab == i).astype(np.uint8)
        cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cnt = max(cnts, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(cnt)
        off = x > 3 and y > 3 and x + w < W_ - 4 and y + h < H_ - 4
        hull = cv2.convexHull(cnt); peri = cv2.arcLength(hull, True)
        quad = None
        for eps in np.linspace(0.005, 0.08, 30):
            a = cv2.approxPolyDP(hull, eps * peri, True)
            if len(a) == 4: quad = order(a.reshape(4, 2).astype(np.float64)); break
        if quad is None:
            r = cv2.minAreaRect(cnt); quad = order(cv2.boxPoints(r).astype(np.float64))
        occ = covered_edges(quad, cnt, gray)
        found.append((snap(quad, cnt) if off and "c" not in occ else quad, cnt, off, float(stats[i, cv2.CC_STAT_AREA]), occ))
    return found

def flow_h(g0, g1, quad):
    """The homography of the wall around a canvas from one frame to the next."""
    poly = quad.astype(np.int32)
    inner = np.zeros((H_, W_), np.uint8); cv2.fillPoly(inner, [poly], 255)
    band = cv2.dilate(inner, np.ones((61, 61), np.uint8)) & ~cv2.erode(inner, np.ones((9, 9), np.uint8))
    p0 = cv2.goodFeaturesToTrack(g0, 500, 0.005, 5, mask=band)
    if p0 is None or len(p0) < 10: return None
    p1, st, _ = cv2.calcOpticalFlowPyrLK(g0, g1, p0, None, winSize=(25, 25), maxLevel=4)
    pb, st2, _ = cv2.calcOpticalFlowPyrLK(g1, g0, p1, None, winSize=(25, 25), maxLevel=4)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((pb - p0).reshape(-1, 2), axis=1) < 1.0)
    if ok.sum() < 10: return None
    Hm, _ = cv2.findHomography(p0[ok], p1[ok], cv2.RANSAC, 1.5)
    return Hm

def overlap(quad, cnt):
    a = np.zeros((H_, W_), np.uint8); cv2.fillPoly(a, [quad.astype(np.int32)], 1)
    b = np.zeros((H_, W_), np.uint8); cv2.drawContours(b, [cnt], -1, 1, -1)
    i = (a & b).sum(); u = (a | b).sum()
    return i / u if u else 0

def track(seq):
    """Follows every canvas forward through seq. Returns [{quads: [...], full: [...]}] in first-seen order."""
    grays = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in seq]
    tracks = []
    for t, f in enumerate(seq):
        dets = detect(key_mask(f), grays[t])
        used = set()
        for tr in tracks:
            prev = tr["quads"][t - 1]
            if prev is None: tr["quads"].append(None); tr["full"].append(False); continue
            Hm = flow_h(grays[t - 1], grays[t], prev)
            pred = cv2.perspectiveTransform(prev.reshape(-1, 1, 2), Hm).reshape(4, 2) if Hm is not None else prev
            best, score = None, 0.3
            for k, (q, cnt, off, area, occ) in enumerate(dets):
                if k in used: continue
                s = overlap(pred, cnt)
                if s > score: best, score = k, s
            if best is None:
                # a small canvas can slip past the overlap test when the wall's flow is pulled by a jamb beside it:
                # take the nearest blob of a similar size within half the canvas's diagonal of where it was
                pa, pc = max(cv2.contourArea(prev.astype(np.float32)), 1), prev.mean(axis=0)
                reach = 0.5 * np.linalg.norm(prev[2] - prev[0]) + 4
                for k, (q, cnt, off, area, occ) in enumerate(dets):
                    if k in used or not (0.2 < area / pa < 2.5): continue
                    dd = np.linalg.norm(q.mean(axis=0) - pc)
                    if dd < reach: best, reach = k, dd
            if best is None:
                # a canvas mostly behind a jamb: a sliver of green lying wholly inside where it should be
                pm = np.zeros((H_, W_), np.uint8); cv2.fillPoly(pm, [np.round(pred).astype(np.int32)], 1)
                pm = cv2.dilate(pm, np.ones((5, 5), np.uint8))
                for k, (q, cnt, off, area, occ) in enumerate(dets):
                    if k in used or area > 1.1 * visible_area(pred): continue
                    bm = np.zeros((H_, W_), np.uint8); cv2.drawContours(bm, [cnt], -1, 1, -1)
                    if (bm & pm).sum() > 0.9 * max(bm.sum(), 1) and "c" in occ: best = k; break
            if best is None:
                inside = (pred[:, 0] > -W_) & (pred[:, 0] < 2 * W_)
                # no green where a canvas wholly inside the image should be: it went behind something; end the track
                # (one cut by the image border is carried on, as before)
                hidden = visible_area(pred) > 0.97 * max(cv2.contourArea(pred.astype(np.float32)), 1)
                tr["quads"].append(pred if inside.all() and Hm is not None and not hidden else None); tr["full"].append(False); continue
            used.add(best)
            q, cnt, off, area, occ = dets[best]
            seen = visible_area(pred)
            covered = "c" in occ
            if off and not covered:
                # the whole canvas, every edge in its frame: its own outline (full only if it isn't smaller than the
                # wall predicts)
                tr["quads"].append(q); tr["full"].append(area >= 0.9 * seen)
                if tr["full"][-1]: tr["anchor"] = q
                continue
            if covered or (Hm is not None and area < 0.9 * seen):
                # something covers part of it: last frame's shape carried on its solid corners, refitted only on the
                # edges that still show their frame, never the squeezed blob
                tr["quads"].append(carry(prev, pred, q, cnt, occ, tr.get("anchor"))); tr["full"].append(False); continue
            tr["quads"].append(snap(pred, cnt, contain=True)); tr["full"].append(False)  # cut by the image border only
        for k, (q, cnt, off, area, occ) in enumerate(dets):
            if k in used: continue
            tracks.append({"quads": [None] * t + [q], "full": [False] * t + [off and "c" not in occ], "x": q[:, 0].mean(),
                           "anchor": q if off and "c" not in occ else None})
    return tracks

fwd = track(frames)
bwd = track(frames[::-1])
for tr in bwd: tr["quads"].reverse(); tr["full"].reverse()

# join the two passes: the same canvas is the one whose quads agree where both are in full view; per frame, use the
# pass that saw the canvas whole most recently, unless the two disagree by more than 10 % in visible area: then the
# larger one (a covered canvas only ever shrinks)
def dist_to_full(full):
    d, last, out = 0, None, []
    for f in full:
        last = 0 if f else (None if last is None else last + 1); out.append(1e9 if last is None else last)
    return out

def agree(ta, tb):
    both = [i for i in range(N) if ta["quads"][i] is not None and tb["quads"][i] is not None]
    return bool(both) and np.median([np.abs(ta["quads"][i] - tb["quads"][i]).mean() for i in both]) < 12

panels, taken = [], set()
for tf in fwd:
    j = next((j for j, tb in enumerate(bwd) if j not in taken and agree(tf, tb)), None)
    if j is None and not any(tf["full"]): continue  # forward-only and never whole: not a canvas we can place
    if j is not None: taken.add(j)
    tb = bwd[j] if j is not None else None
    df = dist_to_full(tf["full"])
    db = dist_to_full(tb["full"][::-1])[::-1] if tb else [1e9] * N
    quads, full = [], []
    for i in range(N):
        a, b = tf["quads"][i], tb["quads"][i] if tb else None
        if a is not None and b is not None:
            va, vb = visible_area(a), visible_area(b)
            if (df[i] >= 1e9) != (db[i] >= 1e9):
                use_a = db[i] >= 1e9  # only one pass has seen it whole yet: the other's quad is a squeezed blob
            else:
                use_a = (va >= vb) if max(va, vb) > 1.1 * max(min(va, vb), 1) else df[i] <= db[i]
        else:
            use_a = b is None
        quads.append(a if use_a else b)
        full.append(bool(tf["full"][i] if use_a else tb["full"][i]))
    panels.append((quads, full))
# canvases only the backward pass followed (they come into view during the clip)
panels += [(tb["quads"], [bool(x) for x in tb["full"]]) for j, tb in enumerate(bwd) if j not in taken and any(tb["full"])]

# light smoothing of the corner paths (a 5-frame window) where a canvas is in view
def smooth(quads):
    arr = [q if q is not None else None for q in quads]
    out = []
    for i in range(N):
        if arr[i] is None: out.append(None); continue
        # a centred window only (radius ≤ 2, shrunk until every frame in it has a quad), so the corners never lag
        # behind a canvas moving fast at the end of a track or beside a gap
        r = 2
        while r > 0 and any(j < 0 or j >= N or arr[j] is None for j in range(i - r, i + r + 1)): r -= 1
        out.append(np.mean([arr[j] for j in range(i - r, i + r + 1)], axis=0))
    return out

order_x = lambda p: next((q[:, 0].mean() for q in p[0] if q is not None), 1e9)
# the same canvas followed twice (a pass that lost it and found it again): keep the copy seen whole more often
def iou(a, b):
    try:
        i, _ = cv2.intersectConvexConvex(a.astype(np.float32), b.astype(np.float32))
    except cv2.error:
        return 0
    u = visible_area(a) + visible_area(b) - i
    return i / u if u > 0 else 0

dupes = set()
for x in range(len(panels)):
    for y in range(x + 1, len(panels)):
        if x in dupes or y in dupes: continue
        both = [i for i in range(N) if panels[x][0][i] is not None and panels[y][0][i] is not None]
        if len(both) >= 3 and np.median([iou(panels[x][0][i], panels[y][0][i]) for i in both]) > 0.5:
            keep, drop = (x, y) if sum(panels[x][1]) >= sum(panels[y][1]) else (y, x)
            # merge, not drop: the kept copy takes the other's quad where it has none, or where only the other saw
            # the canvas whole
            for i in range(N):
                a, b = panels[keep][0][i], panels[drop][0][i]
                if b is None: continue
                fa, fb = panels[keep][1][i], panels[drop][1][i]
                # where neither saw it whole, the larger quad (a covered canvas only ever shrinks)
                if a is None or (fb and not fa) or (not fa and not fb and visible_area(b) > 1.1 * visible_area(a)):
                    panels[keep][0][i], panels[keep][1][i] = b, fb
            dupes.add(drop)
panels = [p for k, p in enumerate(panels) if k not in dupes and any(p[1]) and sum(q is not None for q in p[0]) >= 3]

# Canvases on one wall keep their places on it: where a canvas is covered or lost while a partner on the same wall is
# whole, its quad is the partner's wall mapping applied to its place on that wall (measured over the frames where
# both were whole), then refitted on the edges of it that still show their frame. Partners count as one wall only if
# that place holds to 2.5 px over ≥ 6 frames; the fill reaches at most 40 frames from the nearest frame where both
# were whole, only where the predicted quad lies inside the image (a canvas cut by the image border is left as it
# was) and only where some of its green shows.
UNIT = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
def unit_h(q): return cv2.getPerspectiveTransform(UNIT, q.astype(np.float32)).astype(np.float64)
def apply_h(Hm, pts): return cv2.perspectiveTransform(pts.reshape(-1, 1, 2).astype(np.float64), Hm).reshape(-1, 2)

def inside_img(q, m=4): return bool(((q[:, 0] > m) & (q[:, 0] < W_ - m) & (q[:, 1] > m) & (q[:, 1] < H_ - m)).all())

def fill_from_partners(panels):
    n = len(panels)
    rel = {}
    for y in range(n):
        for x in range(n):
            if x == y: continue
            both = [i for i in range(N) if panels[x][1][i] and panels[y][1][i]]
            if len(both) < 6: continue
            cs = np.array([apply_h(np.linalg.inv(unit_h(panels[x][0][i])), panels[y][0][i]) for i in both])
            c = np.median(cs, axis=0)
            err = np.median([np.abs(apply_h(unit_h(panels[x][0][i]), c) - panels[y][0][i]).max() for i in both])
            if err < 2.5: rel[(x, y)] = (c, np.array(both), err)
    filled = 0
    for y in range(n):
        partners = [(x, v) for (x, yy), v in rel.items() if yy == y]
        if not partners: continue
        quads, full = panels[y]
        for i in range(N):
            if full[i]: continue
            preds = []
            for x, (c, both, err) in partners:
                if not panels[x][1][i] or np.abs(both - i).min() > 40: continue
                area = cv2.contourArea(panels[x][0][i].astype(np.float32))
                preds.append((area, apply_h(unit_h(panels[x][0][i]), c)))
            if not preds: continue
            p = max(preds, key=lambda t: t[0])[1]  # the largest partner whole in this frame
            if not inside_img(p): continue
            f = frames[i]
            key = key_mask(f)
            area_m = np.zeros((H_, W_), np.uint8); cv2.fillPoly(area_m, [np.round(p).astype(np.int32)], 1)
            shows = int(((key > 0) & (area_m > 0)).sum())
            if shows < 0.03 * max(area_m.sum(), 1): continue
            # refit the edges that show their frame on the green blob under the prediction
            dets = detect(key, cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
            best = max(dets, key=lambda d: overlap(p, d[1]), default=None)
            if best is not None and overlap(p, best[1]) > 0.05:
                occ = covered_edges(p, best[1], cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
                r = snap(p, best[1], keep=[e != "f" for e in occ])
                if np.abs(r - p).max() < max(6, 0.06 * np.linalg.norm(p[2] - p[0])): p = r
            quads[i] = p; filled += 1
    return filled

n_filled = fill_from_partners(panels)

# a covered quad must keep the shape the canvas has when whole. Walking out from every frame where the canvas was
# whole, each quad inside the image that isn't whole must be convex, show some green (≥ 3 % of it: a canvas wholly
# behind a jamb gets no quad, so no label claims it) and keep its edge lengths within 15 % of the last quad accepted
# on that walk; one that fails becomes null (the page holds the last good quad briefly), and the walk goes on
# against the last good one. Canvases cut only by the image border are left as they were.
def edges_len(q): return np.array([np.linalg.norm(q[(k + 1) % 4] - q[k]) for k in range(4)])
n_dropped = 0
keys = {}
def green_share(i, q):
    if i not in keys: keys[i] = key_mask(frames[i])
    m = np.zeros((H_, W_), np.uint8); cv2.fillPoly(m, [np.round(q).astype(np.int32)], 1)
    return ((keys[i] > 0) & (m > 0)).sum() / max(m.sum(), 1)
for quads, full in panels:
    bad = set()
    fi = [i for i in range(N) if full[i]]
    for j in fi:
        for step in (1, -1):
            last = quads[j]; i = j + step
            while 0 <= i < N and not full[i] and quads[i] is not None:
                q = quads[i]
                if inside_img(q):
                    ratio = edges_len(q) / np.maximum(edges_len(last), 1)
                    ok = (cv2.isContourConvex(np.round(q).astype(np.int32)) and 0.85 < ratio.min() and ratio.max() < 1.18
                          and green_share(i, q) >= 0.03)
                    if ok: last = q
                    else: bad.add(i)
                i += step
    for i in range(N):
        q = quads[i]
        if q is None or full[i]: continue
        # every quad that isn't whole, cut by the image border or not: convex, and some of its green in view
        j = min(fi, key=lambda j: abs(j - i)) if fi else None
        a_ratio = cv2.contourArea(q.astype(np.float32)) / max(cv2.contourArea(quads[j].astype(np.float32)), 1) if j is not None else 1
        wild = not (((q[:, 0] > -W_) & (q[:, 0] < 2 * W_) & (q[:, 1] > -H_) & (q[:, 1] < 2 * H_)).all())
        if (i in bad or wild or not cv2.isContourConvex(np.round(q).astype(np.int32)) or green_share(i, q) < 0.03
                or (inside_img(q) and not 0.5 < a_ratio < 2.0)):  # inside the image: about its size when whole
            quads[i] = None; n_dropped += 1
panels = [p for p in panels if sum(q is not None for q in p[0]) >= 3]

panels = sorted([(smooth(q), f) for q, f in panels], key=order_x)

# the median grey of each canvas's keyed pixels inside its quad, in the units of frames.mjs --key's light map
def median_grey(f, q, key):
    area = np.zeros((H_, W_), np.uint8); cv2.fillPoly(area, [np.round(q).astype(np.int32)], 1)
    sel = (area > 0) & (key > 0)
    if sel.sum() < 50: return None
    px = f[sel].astype(np.float32)
    lum = 0.25 * px[:, 2] + 0.6 * px[:, 1] + 0.15 * px[:, 0]
    return round(float(np.median(np.clip(lum * 0.92, 0, 255))), 1)

medians = [[None] * N for _ in panels]
for i, f in enumerate(frames):
    key = None
    for k, (quads, _) in enumerate(panels):
        if quads[i] is None: continue
        if key is None: key = key_mask(f)
        medians[k][i] = median_grey(f, quads[i], key)

out = args.out or args.clip.replace(".mp4", ".panels.json")
json.dump({"size": [W_, H_], "fps": fps, "count": N, "panels": [
    {"id": k, "quads": [None if q is None else [round(float(v), 2) for v in q.ravel()] for q in quads],
     "full": full, "medians": medians[k]} for k, (quads, full) in enumerate(panels)]},
    open(out, "w"))
print(f"{len(panels)} canvases over {N} frames → {out} ({n_filled} quads filled from a partner on the same wall, {n_dropped} misshapen covered quads dropped)")
for k, (quads, full) in enumerate(panels):
    first = next(i for i, q in enumerate(quads) if q is not None)
    cx, cy = quads[first].mean(axis=0)
    print(f"  canvas {k}: in view {sum(q is not None for q in quads)}/{N} frames, whole in {sum(full)}; "
          f"first seen in frame {first} at ({cx:.0f}, {cy:.0f})")

if args.proof:
    art = cv2.imread(args.proof)
    ah, aw = art.shape[:2]
    src = np.array([[0, 0], [aw, 0], [aw, ah], [0, ah]], np.float32)
    dest = args.clip.replace(".mp4", "-proof.mp4")
    ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W_}x{H_}", "-r", str(fps),
                           "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", dest], stdin=subprocess.PIPE)
    for i, f in enumerate(frames):
        f = f.copy()
        key = key_mask(f)
        shows = cv2.dilate(key, np.ones((5, 5), np.uint8)) > 0  # where the canvas's green shows, as the page's mask
        # light on the canvas: its green, relative to its median, carries the room's light onto the art
        b, g, r = cv2.split(f.astype(np.float32))
        labels = []
        for k, (quads, full) in enumerate(panels):
            q = quads[i]
            if q is None: continue
            M = cv2.getPerspectiveTransform(src, q.astype(np.float32))
            warped = cv2.warpPerspective(art, M, (W_, H_), flags=cv2.INTER_LINEAR)
            area = np.zeros((H_, W_), np.uint8); cv2.fillPoly(area, [np.round(q).astype(np.int32)], 255)
            area = cv2.dilate(area, np.ones((3, 3), np.uint8))
            sel = (area > 0) & (key > 0)
            med = np.median(g[sel]) if sel.any() else 1
            light = np.clip(cv2.GaussianBlur(g, (0, 0), 3) / max(med, 1), 0.6, 1.25)
            shaded = np.clip(warped.astype(np.float32) * light[..., None], 0, 255).astype(np.uint8)
            m = (area > 0) & shows
            f[m] = shaded[m]
            labels.append((f"{k}" + ("" if full[i] else "~"), q.mean(axis=0)))
        # despill: no surface outside the canvases keeps a green cast (floor reflections, bounced light)
        b, g, r = cv2.split(f.astype(np.int16))
        g = np.minimum(g, np.maximum(r, b) + 4)
        f = cv2.merge([b, g, r]).clip(0, 255).astype(np.uint8)
        for text, (cx, cy) in labels:
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.4, 3)
            org = (int(cx - tw / 2), int(cy + th / 2))
            cv2.putText(f, text, org, cv2.FONT_HERSHEY_SIMPLEX, 1.4, (255, 255, 255), 7, cv2.LINE_AA)
            cv2.putText(f, text, org, cv2.FONT_HERSHEY_SIMPLEX, 1.4, (20, 20, 20), 3, cv2.LINE_AA)
        ff.stdin.write(f.tobytes())
    ff.stdin.close(); ff.wait()
    print(f"proof → {dest}")
