"""Uji cepat paket handoff: model + normalisasi + prediksi dari landmarks.csv.

Jalankan dari folder ini:
    py -3.11 test_handoff.py

Lulus jika >=95% sampel uji benar (target: 100%).
"""
import csv
import os
import sys
from collections import defaultdict

import joblib
import numpy as np
import sklearn

from inference import GesturePredictor
from normalization import feature_names

BASE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(BASE, "landmarks.csv")
PER_CLASS = 10


def main():
    print("Python paket :", sys.version.split()[0])
    print("numpy        :", np.__version__)
    print("scikit-learn :", sklearn.__version__)
    print("joblib       :", joblib.__version__)

    predictor = GesturePredictor()
    print("model        :", type(predictor.model.named_steps["clf"]).__name__)
    print("label        :", ", ".join(predictor.labels))

    feats = feature_names()
    rows = []
    seen = defaultdict(int)
    with open(CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if seen[row["label"]] < PER_CLASS:
                rows.append(row)
                seen[row["label"]] += 1
            if all(seen[lab] >= PER_CLASS for lab in predictor.labels):
                break

    benar = 0
    salah = []
    W, H = 640, 480
    SKALA = 50.0          # 1 unit fitur = 50 px (meniru tangan ~50-250 px)
    OX, OY = 320.0, 240.0
    for row in rows:
        v = [float(row[c]) for c in feats]
        # bentuk ulang menjadi koordinat ternormalisasi ala MediaPipe,
        # lalu uji jalur image_size -> piksel -> normalisasi
        pts = [((v[3 * i] * SKALA + OX) / W,
                (v[3 * i + 1] * SKALA + OY) / H,
                0.0) for i in range(21)]
        out = predictor.predict(pts, image_size=(W, H))
        if out["gesture"] == row["label"]:
            benar += 1
        else:
            salah.append((row["label"], out["gesture"], out["confidence"]))

    akurasi = benar / len(rows) * 100
    print(f"\nhasil        : {benar}/{len(rows)} benar ({akurasi:.1f}%)")
    if salah:
        print("contoh salah :", salah[:5])
    print("contoh JSON  :", predictor.predict_json(pts, image_size=(W, H)))

    if akurasi < 95.0:
        print("\nGAGAL: akurasi sampel < 95%. Cek versi scikit-learn/model.")
        return 1
    print("\nHANDOFF OK — model, normalisasi, dan labels konsisten.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
