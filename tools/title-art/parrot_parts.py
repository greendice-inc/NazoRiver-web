"""Cut the parrot's wing, upper beak and lower jaw into separate layers and patch the background under them.

Region ids come from labelling the parrot crop by its outlines (see parrot_labels.png):
wing = 12 (red), 15 (yellow), 20 (green); upper beak = 7; lower jaw = 11.
"""
import cv2, numpy as np, json
from PIL import Image

SRC = "clean_final2.png"
OUT_BG = "/home/claude/greendice-inc/nazoriver-web/public/art/title/bg.webp"
OUT_DIR = "/home/claude/greendice-inc/nazoriver-web/public/art/title/"
X0, Y0 = 20, 380

im = cv2.imread(SRC)
lab = np.load("parrot_lab.npy")
H, W = im.shape[:2]


def full(m):
    out = np.zeros((H, W), np.uint8)
    out[Y0:Y0 + m.shape[0], X0:X0 + m.shape[1]] = m
    return out


def region(ids, close_k, grow):
    m = np.isin(lab, ids).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k)))
    if grow:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    return full(m)


wing = region([12, 15, 20], 9, 3)
beak = region([7], 5, 3)
jaw = region([11], 5, 2)
jaw &= ~beak

parts = {}


def cut(name, m, pivot_rule):
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
    alpha = cv2.GaussianBlur(m[y0:y1, x0:x1].astype(np.float32) / 255, (0, 0), 0.6)
    rgb = cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(f"{OUT_DIR}parrot_{name}.webp", lossless=True)
    px, py = pivot_rule(xs, ys)
    parts[name] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "px": int(px), "py": int(py)}


# Wing hinges at the shoulder: top of the wing, toward the body (right).
cut("wing", wing, lambda xs, ys: (np.percentile(xs, 70), ys.min() + 18))
# Upper beak hinges where it meets the face: its left edge, upper third.
cut("beak", beak, lambda xs, ys: (xs.min() + 6, ys.min() + (ys.max() - ys.min()) * 0.3))
# Lower jaw hinges at its top-left corner.
cut("jaw", jaw, lambda xs, ys: (xs.min() + 4, ys.min() + 4))

# Patch the background under the moving parts.
bg = im.copy()
under_wing = cv2.erode(wing, np.ones((3, 3), np.uint8)) > 0
# Body sits under most of the wing; below the feet line the wing tip hangs over the branch/tail instead.
FEET_Y = 790
body_part = under_wing.copy()
body_part[FEET_Y:] = False
bg[body_part] = (24, 44, 196)           # BGR shadowed body red (#c42c18)
below = under_wing.copy()
below[:FEET_Y] = False
if below.any():
    hole = cv2.dilate(below.astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
    hole[:FEET_Y - 2] = 0
    bg = cv2.inpaint(bg, hole, 9, cv2.INPAINT_TELEA)
mouth = cv2.erode(beak | jaw, np.ones((3, 3), np.uint8)) > 0
bg[mouth] = (50, 34, 150)               # BGR mouth inside (#962232)
Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB)).save(OUT_BG, quality=90, method=6)
cv2.imwrite("bg_parrot_patched.png", bg[Y0 + 100:Y0 + 520, X0:X0 + 320])

print(json.dumps(parts))
