"""Exemplar-based (Criminisi-style) inpainting, full resolution, windowed search, per-region crops."""
import cv2, numpy as np, time

im = cv2.imread("on_full.png")
H, W = im.shape[:2]
geki, nazo, pill, rib, corp = [np.load(f"m_{k}.npy") for k in ("geki", "nazo", "pill", "rib", "corp")]


def dil(m, r):
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


mask = dil(geki | nazo | pill, 46) | dil(rib, 30) | dil(corp, 26)
cv2.imwrite("inpaint_mask2.png", mask)

# areas that must never be used as source (characters etc.)
forbid = np.zeros((H, W), np.uint8)
forbid[380:1080, 0:340] = 1      # parrot + branch
forbid[280:1080, 1060:1920] = 1  # boat & crew
forbid[0:330, 1330:1860] = 1     # octopus

PS = 15
h = PS // 2
WIN = 260

out = im.astype(np.float32).copy()
unk_all = (mask > 0).astype(np.uint8)

n, lab, stats, _ = cv2.connectedComponentsWithStats(unk_all, connectivity=8)
t0 = time.time()
for ci in range(1, n):
    x, y, w, hh, area = stats[ci]
    M = 40
    x0, y0 = max(0, x - WIN), max(0, y - WIN)
    x1, y1 = min(W, x + w + WIN), min(H, y + hh + WIN)
    img = out[y0:y1, x0:x1]
    unk = (lab[y0:y1, x0:x1] == ci).astype(np.uint8)
    other = ((unk_all[y0:y1, x0:x1] > 0) & (unk == 0)).astype(np.uint8)
    bad = ((forbid[y0:y1, x0:x1] > 0) | (other > 0)).astype(np.uint8)
    conf = (1 - unk).astype(np.float32)
    ch, cw = unk.shape
    it = 0
    while True:
        if unk.sum() == 0:
            break
        er = cv2.erode(unk, np.ones((3, 3), np.uint8))
        front = (unk - er) > 0
        ys, xs = np.nonzero(front)
        cmean = cv2.boxFilter(conf, -1, (PS, PS), normalize=True, borderType=cv2.BORDER_CONSTANT)
        gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        ign = cv2.dilate(unk, np.ones((5, 5), np.uint8)) > 0
        gx[ign] = 0
        gy[ign] = 0
        mx = cv2.Sobel(unk.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
        my = cv2.Sobel(unk.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
        nn = np.sqrt(mx * mx + my * my) + 1e-6
        Dm = np.abs(-gy * mx / nn + gx * my / nn) / 255.0 + 0.001
        # process several well-separated front points per sweep for speed
        P = cmean[ys, xs] * Dm[ys, xs]
        order = np.argsort(-P)
        taken = []
        for k in order[:400]:
            py, px = int(ys[k]), int(xs[k])
            if any(abs(py - ty) < PS * 2 and abs(px - tx) < PS * 2 for ty, tx in taken):
                continue
            taken.append((py, px))
            if len(taken) >= 6:
                break
        for py, px in taken:
            ty0 = min(max(py - h, 0), ch - PS)
            tx0 = min(max(px - h, 0), cw - PS)
            tgt = unk[ty0:ty0 + PS, tx0:tx0 + PS] > 0
            if not tgt.any():
                continue
            templ = img[ty0:ty0 + PS, tx0:tx0 + PS]
            known = (~tgt).astype(np.float32)
            sy0, sx0 = max(0, ty0 - WIN), max(0, tx0 - WIN)
            sy1, sx1 = min(ch, ty0 + PS + WIN), min(cw, tx0 + PS + WIN)
            search = img[sy0:sy1, sx0:sx1]
            res = cv2.matchTemplate(search, templ, cv2.TM_SQDIFF, mask=np.repeat(known[..., None], 3, axis=2))
            blocked = ((unk[sy0:sy1, sx0:sx1] > 0) | (bad[sy0:sy1, sx0:sx1] > 0)).astype(np.uint8)
            blocked = cv2.dilate(blocked, np.ones((PS, PS), np.uint8), anchor=(0, 0))[: res.shape[0], : res.shape[1]]
            res = np.where(blocked > 0, np.inf, res)
            if not np.isfinite(res).any():
                img[ty0:ty0 + PS, tx0:tx0 + PS][tgt] = cv2.blur(img, (31, 31))[ty0:ty0 + PS, tx0:tx0 + PS][tgt]
            else:
                sy, sx = np.unravel_index(int(np.argmin(res)), res.shape)
                src = search[sy:sy + PS, sx:sx + PS]
                img[ty0:ty0 + PS, tx0:tx0 + PS][tgt] = src[tgt]
            conf[ty0:ty0 + PS, tx0:tx0 + PS][tgt] = cmean[py, px]
            unk[ty0:ty0 + PS, tx0:tx0 + PS][tgt] = 0
        it += 1
        if it % 100 == 0:
            print(ci, it, int(unk.sum()), round(time.time() - t0, 1), flush=True)
    out[y0:y1, x0:x1] = img
    print("region", ci, "done", round(time.time() - t0, 1), flush=True)

res = out.astype(np.uint8)
cv2.imwrite("clean_full.png", res)
cv2.imwrite("clean_small.png", cv2.resize(res, (1280, 720), interpolation=cv2.INTER_AREA))
print("total", round(time.time() - t0, 1))
