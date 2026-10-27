"""Build the water mask texture for the animated title water.

R = river water (soft edge), G = foam boost near banks/boat, B = waterfall.
Output: water_mask.png (960x540, half-res is plenty for a soft mask) + debug overlay.
"""
import cv2, numpy as np

clean = cv2.imread("clean_final.png")
orig = cv2.imread("on_full.png")
H, W = clean.shape[:2]


def waterish(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = [hsv[..., i].astype(int) for i in range(3)]
    blue = (h >= 88) & (h <= 128) & (s >= 45) & (v >= 120)
    white = ((s <= 26) & (v >= 210)) | ((h >= 85) & (h <= 130) & (s <= 60) & (v >= 205))
    return blue | white


def fill_small(mask, max_area):
    inv = (~mask).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    out = mask.copy()
    for i in range(1, n):
        if st[i][4] <= max_area:
            out[lab == i] = True
    return out


# --- river ---------------------------------------------------------------
wc = waterish(clean)
wo = waterish(orig)
# Inside the old ribbon area the clean image is a reconstruction; trust its water. Elsewhere use the original.
ribbon = np.load("m_rib.npy") > 0
ribbon = cv2.dilate(ribbon.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
corp = cv2.dilate((np.load("m_corp.npy") > 0).astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
w = np.where(ribbon | corp, wc, wo)
w[:430] = False
w = fill_small(w, 2500)
n, lab, st, _ = cv2.connectedComponentsWithStats(w.astype(np.uint8), connectivity=4)
bottom_ids = set(lab[H - 1][lab[H - 1] > 0].tolist())
river = np.isin(lab, list(bottom_ids))
river = cv2.morphologyEx(river.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
river = fill_small(river, 2500)

# --- waterfall -----------------------------------------------------------
box = np.zeros((H, W), bool)
box[200:700, 1400:1790] = True
wf = wo & box
wf = fill_small(wf, 1500)
n, lab, st, _ = cv2.connectedComponentsWithStats(wf.astype(np.uint8), connectivity=4)
wf = np.isin(lab, [i for i in range(1, n) if st[i][4] >= 5000])
wf &= ~river

# --- channels ------------------------------------------------------------
def soft(m, r):
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), r)


R = np.clip(soft(river, 1.2), 0, 1)
B = np.clip(soft(wf, 1.2), 0, 1)
solid = ~(river | wf)
# foam boost: how close a water pixel is to something solid (bank, boat, parrot)
dist = cv2.distanceTransform((~solid).astype(np.uint8), cv2.DIST_L2, 5)
G = np.clip(1.0 - dist / 46.0, 0, 1) ** 1.6
G *= river
# churning plunge pool where the waterfall lands
pool = soft(cv2.dilate(wf.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81))) > 0, 14)
G = np.maximum(G, np.clip(pool * 1.2, 0, 1) * river)

tex = np.dstack([B, G, R])  # BGR order for cv2
tex = cv2.resize(tex, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
cv2.imwrite("water_mask.png", (np.clip(tex, 0, 1) * 255).astype(np.uint8))

dbg = orig.copy().astype(np.float32)
dbg[river] = dbg[river] * 0.35 + np.array([255, 0, 255]) * 0.65
dbg[wf] = dbg[wf] * 0.35 + np.array([0, 255, 255]) * 0.65
cv2.imwrite("water_dbg.png", cv2.resize(dbg.astype(np.uint8), (960, 540)))
print("river px", int(river.sum()), "waterfall px", int(wf.sum()))
