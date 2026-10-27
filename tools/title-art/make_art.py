import cv2, numpy as np, sys

im = cv2.imread("on_full.png")  # BGR 1920x1080
H, W = im.shape[:2]
b, g, r = [im[..., i].astype(int) for i in range(3)]
dark = ((r < 120) & (g < 75) & (b < 45) & (r >= g)).astype(np.uint8) * 255
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
h, s, v = [hsv[..., i].astype(int) for i in range(3)]
orange = ((h >= 12) & (h <= 28) & (s > 185) & (v > 215)).astype(np.uint8) * 255

n, lab, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)


def comp_mask(ids):
    m = np.zeros((H, W), np.uint8)
    for i in ids:
        m[lab == i] = 255
    return m


def fill_holes(m):
    pad = cv2.copyMakeBorder(m, 2, 2, 2, 2, cv2.BORDER_CONSTANT, value=0)
    inv = cv2.bitwise_not(pad)
    ff = inv.copy()
    mask = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 0)
    # ff now keeps only holes (non-reachable from the border)
    out = cv2.bitwise_or(pad, ff)
    return out[2:-2, 2:-2]


def close(m, k):
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))


def dil(m, r):
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


def in_box(m, x0, y0, x1, y1):
    o = np.zeros_like(m)
    o[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    return o


# --- logo pieces -----------------------------------------------------------
# component ids found in mask1.py: 10 = ナゾリバー outline, 11 = piece inside it, 1 = 激流！, 2 = pill
nazo = fill_holes(close(comp_mask([10, 11]), 5))
geki = fill_holes(close(comp_mask([1]), 5))
pill = fill_holes(close(comp_mask([2]), 5))

# --- ribbon text areas -----------------------------------------------------
rib_dark = in_box(dark, 380, 540, 1072, 900)
rib_orange = in_box(orange, 380, 540, 1072, 900)
# keep only orange blobs that are big (the swooshes), drop boat/oar bits
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(rib_orange, connectivity=8)
keep = np.zeros_like(rib_orange)
for i in range(1, n2):
    if st2[i][4] > 600:
        keep[lab2 == i] = 255
ribbons = fill_holes(close(cv2.bitwise_or(keep, rib_dark), 21))

# --- company logo ----------------------------------------------------------
corp_src = in_box(cv2.bitwise_or(dark, orange), 190, 895, 430, 1080)
corp = fill_holes(close(corp_src, 9))

np.save("m_geki.npy", geki)
np.save("m_nazo.npy", nazo)
np.save("m_pill.npy", pill)
np.save("m_rib.npy", ribbons)
np.save("m_corp.npy", corp)

# debug overlay
dbg = im.copy()
for m, col in ((nazo, (0, 0, 255)), (geki, (0, 255, 0)), (pill, (255, 0, 0)), (ribbons, (0, 255, 255)), (corp, (255, 0, 255))):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(dbg, cnts, -1, col, 2)
cv2.imwrite("dbg_masks.png", cv2.resize(dbg, (1280, 720)))
print("ok", [int((m > 0).sum()) for m in (geki, nazo, pill, ribbons, corp)])
