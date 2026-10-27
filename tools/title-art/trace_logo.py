"""Segment the letter fills of 激流！ and ナゾリバー and trace them into SVG paths."""
import cv2, numpy as np, potrace

im = cv2.imread("on_full.png")
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
h, s, v = [hsv[..., i].astype(int) for i in range(3)]
geki = np.load("m_geki.npy") > 0
nazo = np.load("m_nazo.npy") > 0

blue = (h >= 82) & (h <= 128) & (s >= 45) & (v >= 120) & nazo
orange = (h <= 32) & (s >= 110) & (v >= 150) & geki


def clean(m, close_k=3, min_area=60):
    m = m.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = np.zeros_like(m)
    for i in range(1, n):
        if st[i][4] >= min_area:
            out[lab == i] = 255
    # fill tiny holes (wave lines are inside the fill)
    inv = 255 - out
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    for i in range(1, n):
        if st[i][4] < 120:
            out[lab == i] = 255
    return out


blue_m = clean(blue, 5)
orange_m = clean(orange, 3)
cv2.imwrite("fill_blue.png", blue_m)
cv2.imwrite("fill_orange.png", orange_m)

SC = 4  # trace at 4x for smooth curves


def trace(mask, name, x0, y0):
    big = cv2.resize(mask, None, fx=SC, fy=SC, interpolation=cv2.INTER_LINEAR)
    big = cv2.GaussianBlur(big, (0, 0), SC * 0.9)
    bm = big > 127
    bmp = potrace.Bitmap(~bm)
    path = bmp.trace(turdsize=40 * SC, alphamax=1.05, opticurve=True, opttolerance=0.4)
    parts = []
    for curve in path:
        sp = curve.start_point
        d = [f"M{sp.x / SC - x0:.2f},{sp.y / SC - y0:.2f}"]
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x / SC - x0:.2f},{seg.c.y / SC - y0:.2f}L{seg.end_point.x / SC - x0:.2f},{seg.end_point.y / SC - y0:.2f}")
            else:
                d.append(
                    f"C{seg.c1.x / SC - x0:.2f},{seg.c1.y / SC - y0:.2f} {seg.c2.x / SC - x0:.2f},{seg.c2.y / SC - y0:.2f} {seg.end_point.x / SC - x0:.2f},{seg.end_point.y / SC - y0:.2f}"
                )
        d.append("Z")
        parts.append("".join(d))
    d = "".join(parts)
    with open(f"path_{name}.txt", "w") as f:
        f.write(d)
    ys, xs = np.nonzero(mask)
    print(name, "bbox", xs.min(), ys.min(), xs.max(), ys.max(), "curves", len(path), "chars", len(d))


trace(orange_m, "geki", 0, 0)
trace(blue_m, "nazo", 0, 0)

dbg = im.copy()
dbg[blue_m > 0] = (dbg[blue_m > 0] * 0.3 + np.array([0, 0, 255]) * 0.7).astype(np.uint8)
dbg[orange_m > 0] = (dbg[orange_m > 0] * 0.3 + np.array([0, 255, 0]) * 0.7).astype(np.uint8)
cv2.imwrite("dbg_fill.png", dbg[40:520, 40:1420])
