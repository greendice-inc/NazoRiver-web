"""Smooth the inpainted areas (cel look), patch small leftovers, write public/art/title/bg.webp."""
import cv2, numpy as np
from PIL import Image
im = cv2.imread("clean_full.png")
mask = cv2.imread("inpaint_mask2.png", 0)
ms = cv2.medianBlur(cv2.pyrMeanShiftFiltering(im, sp=12, sr=34, maxLevel=2), 7)
soft = cv2.GaussianBlur((mask > 0).astype(np.float32), (0, 0), 6)[..., None]
im = (im * (1 - soft) + ms * soft).astype(np.uint8)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
H, W = im.shape[:2]
m = np.zeros((H, W), np.uint8)
b, g, r = [im[..., i].astype(int) for i in range(3)]
dark = ((r < 90) & (g < 90) & (b < 90)).astype(np.uint8)
box = np.zeros_like(m); box[980:1075, 90:215] = 1
m |= dark & box
h, s, v = [hsv[..., i].astype(int) for i in range(3)]
orange = ((h >= 12) & (h <= 32) & (s > 120) & (v > 180)).astype(np.uint8)
for (x0, y0, x1, y1) in [(980, 560, 1050, 600), (1040, 725, 1095, 765), (640, 360, 780, 420)]:
    bx = np.zeros_like(m); bx[y0:y1, x0:x1] = 1
    m |= orange & bx
m = cv2.dilate(m * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
im = cv2.inpaint(im, m, 9, cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).save("../../public/art/title/bg.webp", quality=90, method=6)
