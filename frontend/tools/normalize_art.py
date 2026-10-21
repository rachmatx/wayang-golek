"""Chroma-key art ImageGen lalu normalisasi ke kanvas rig 444x562.

Latar magenta dibuang, tepi di-unmultiply, lalu tinggi konten diskalakan ke
495 unit (tinggi konten wayang P2) dan ditempel di tengah kanvas supaya
kaki tidak tertutup footer panggung.

Jalankan:
    .venv/Scripts/python.exe frontend/tools/normalize_art.py <file.png> <nama>
Contoh:
    ... normalize_art.py vibe_images/gatotkaca_sample.png gatotkaca
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "vibe_images"

CANVAS = (444, 562)
TARGET_HEIGHT = 495
TOP = 2


def key_background(bgr):
    border = np.concatenate([
        bgr[:4].reshape(-1, 3), bgr[-4:].reshape(-1, 3),
        bgr[:, :4].reshape(-1, 3), bgr[:, -4:].reshape(-1, 3),
    ])
    bg = np.median(border, axis=0).astype(np.float32)
    diff = np.linalg.norm(bgr.astype(np.float32) - bg, axis=2)
    alpha = np.clip((diff - 38.0) / 34.0, 0.0, 1.0).astype(np.float32)

    hard = (alpha > 0.5).astype(np.uint8)
    kernel = np.ones((3, 3), np.uint8)
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, kernel, iterations=2)
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, kernel, iterations=1)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    if count < 2:
        raise ValueError("tidak ada objek setelah chroma-key")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    keep = cv2.dilate((labels == largest).astype(np.uint8), kernel, iterations=1)
    alpha *= keep

    color = bgr.astype(np.float32)
    soft = (alpha > 0.02) & (alpha < 1.0)
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (color - bg * (1.0 - alpha[..., None])) / safe
    color = np.where(soft[..., None], unmixed, color)
    color = np.clip(color, 0, 255)
    return color, alpha, bg


def bleed_edges(color, alpha):
    """Ganti warna tepi transparan dengan warna interior terdekat.

    Piksel campuran magenta sering lolos dengan alpha tinggi tapi warna masih
    keunguan. Menarik warna dari piksel solid terdekat menghilangkan fringe
    tanpa menggeser siluet.
    """
    blue, green, red = color[:, :, 0], color[:, :, 1], color[:, :, 2]
    magenta = (red > 120) & (blue > 120) & (green < 0.65 * np.minimum(red, blue))
    safe = ((alpha > 0.95) & ~magenta).astype(np.uint8)
    safe = cv2.erode(safe, np.ones((3, 3), np.uint8), iterations=1)
    if safe.max() == 0:
        return color
    dist, labels = cv2.distanceTransformWithLabels(
        1 - safe, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    ys, xs = np.nonzero(safe)
    lut_y = np.zeros(int(labels.max()) + 1, np.int32)
    lut_x = np.zeros(int(labels.max()) + 1, np.int32)
    lut_y[labels[ys, xs]] = ys
    lut_x[labels[ys, xs]] = xs
    nearest = color[lut_y[labels], lut_x[labels]]
    # Warna latar transparan juga ikut diganti; kalau tidak, resize
    # mengontaminasi tepi dengan magenta dari piksel alpha 0.
    return nearest


def normalize(bgr):
    color, alpha, bg = key_background(bgr)
    color = bleed_edges(color, alpha)
    ys, xs = np.nonzero(alpha > 0.05)
    if len(xs) == 0:
        raise ValueError("alpha kosong")
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    crop_color = color[y0:y1 + 1, x0:x1 + 1]
    crop_alpha = alpha[y0:y1 + 1, x0:x1 + 1]

    scale = TARGET_HEIGHT / crop_alpha.shape[0]
    new_w = max(1, round(crop_alpha.shape[1] * scale))
    color_small = cv2.resize(crop_color, (new_w, TARGET_HEIGHT), interpolation=cv2.INTER_AREA)
    alpha_small = cv2.resize(crop_alpha, (new_w, TARGET_HEIGHT), interpolation=cv2.INTER_AREA)

    canvas = np.zeros((CANVAS[1], CANVAS[0], 4), np.float32)
    x = (CANVAS[0] - new_w) // 2
    canvas[TOP:TOP + TARGET_HEIGHT, x:x + new_w, :3] = color_small
    canvas[TOP:TOP + TARGET_HEIGHT, x:x + new_w, 3] = alpha_small * 255
    print(f"bg BGR {bg.round(1)}  crop {x1 - x0 + 1}x{y1 - y0 + 1}  "
          f"scale {scale:.4f}  tempel x={x} y={TOP} {new_w}x{TARGET_HEIGHT}")
    return canvas.astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("name")
    args = parser.parse_args()
    source = Path(args.source)
    if not source.is_absolute():
        source = (ROOT / source).resolve()
    bgr = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if bgr is None:
        print(f"GAGAL: {source} tidak terbaca")
        return 1
    rgba = normalize(bgr)
    out = OUT_DIR / f"{args.name}_normalized.png"
    cv2.imwrite(str(out), rgba)
    print(f"OK: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
