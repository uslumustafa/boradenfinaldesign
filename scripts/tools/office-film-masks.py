#!/usr/bin/env python3
"""Ofis filmi: yüz bulanıklığı için maske dizisi (çıktı zaman çizelgesinde, 30 fps, gri PNG).

kullanım: office-film-masks.py KUTULAR.json ÇIKTI_KLASÖRÜ YAVAŞLATMA KARE_SAYISI [ELİPS_ÇARPANI] [YUMUŞATMA]
  KUTULAR.json  → scripts/tools/office-film-faces.json
  YAVAŞLATMA    → film.sh'deki F (örn. 2.62); çıktı kare k, kaynak kare n = k*0.999/F'e karşılık gelir
Maske: beyaz = bulanık görüntü, siyah = özgün. Her kutu bir elips olarak çizilir (kutu × ELİPS_ÇARPANI), sonra gauss ile yumuşatılır.
Gereken: python3, numpy, opencv-python."""
import json
import os
import sys

import cv2
import numpy as np

if len(sys.argv) < 5:
    sys.exit(__doc__)
boxes_path, outdir = sys.argv[1], sys.argv[2]
slow, count = float(sys.argv[3]), int(sys.argv[4])
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.15
sigma = float(sys.argv[6]) if len(sys.argv) > 6 else 5.0
W, H = 1280, 720

os.makedirs(outdir, exist_ok=True)
for name in os.listdir(outdir):
    if name.endswith(".png"):
        os.remove(os.path.join(outdir, name))
faces = json.load(open(boxes_path, encoding="utf-8"))["faces"]


def at(keys, n):
    """Anahtarlar arasında doğrusal ara değer; uçlarda sabit."""
    keys = sorted(keys)
    if n <= keys[0][0]:
        return keys[0][1:]
    if n >= keys[-1][0]:
        return keys[-1][1:]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= n <= b[0]:
            t = (n - a[0]) / (b[0] - a[0])
            return [a[j] + (b[j] - a[j]) * t for j in range(1, 5)]


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


for k in range(count):
    n = k * 0.999 / slow
    mask = np.zeros((H, W), np.float32)
    for face in faces:
        start, full = face["vis"]
        weight = smooth((n - start) / max(1e-6, full - start))
        if weight <= 0:
            continue
        cx, cy, w, h = at(face["keys"], n)
        layer = np.zeros((H, W), np.uint8)
        # 4 bit ondalık: kenar yumuşak çizilir
        cv2.ellipse(layer, (round(cx * 16), round(cy * 16)), (round(w * scale / 2 * 16), round(h * scale / 2 * 16)),
                    0, 0, 360, 255, -1, cv2.LINE_AA, 4)
        mask = np.maximum(mask, layer.astype(np.float32) * weight)
    mask = cv2.GaussianBlur(mask, (0, 0), sigma)
    mask = np.clip(mask * 1.35, 0, 255)  # yumuşatma merkezi sönükleştirir; hafifçe güçlendir
    cv2.imwrite(os.path.join(outdir, f"{k:04d}.png"), mask.astype(np.uint8))
print(f"ok: {count} maske → {outdir}")
