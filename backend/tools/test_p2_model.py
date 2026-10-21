"""Uji integrasi model P2 lewat jalur asli backend.

Alur yang diuji (tanpa kamera):
  baris landmark HaGRID -> koordinat 0..1 ala MediaPipe (+ image_size)
  -> backend/features.py -> ModelService (models/model_mlp.pkl + labels.json)

Jalankan:  python backend/tools/test_p2_model.py
Lulus bila >= 95% sampel uji benar.
"""
from __future__ import annotations

import csv
import sys
import warnings
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from features import normalize_landmarks  # noqa: E402
from model_service import ModelService  # noqa: E402

CSV_PATH = ROOT / "handoff_p2" / "landmarks.csv"
PER_CLASS = 20  # 6 gestur x 20 = 120 sampel uji


def baca_sampel(per_class: int):
    """Ambil beberapa baris split=test per kelas, lalu ubah ke gaya MediaPipe."""
    samples = []
    seen = {}
    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        n_features = len(header) - 4  # label, split, user_id, image_id
        for row in reader:
            label = row[n_features]
            split = row[n_features + 1]
            if split != "test":
                continue
            if seen.get(label, 0) >= per_class:
                continue
            seen[label] = seen.get(label, 0) + 1
            samples.append((np.asarray([float(v) for v in row[:n_features]]), label))
            if len(seen) == 6 and all(v >= per_class for v in seen.values()):
                break
    return samples


def ke_gaya_mediapipe(features: np.ndarray, width=640, height=480, scale=120.0):
    """Fitur ternormalisasi -> 21 titik 0..1 seperti keluaran MediaPipe.

    Skala + geseran wrist dipilih bebas: normalisasi harus mengembalikannya.
    """
    pts = features.reshape(21, 3)
    wrist = np.array([341.0, 267.0])
    px = pts[:, :2] * scale + wrist
    return np.column_stack([px[:, 0] / width, px[:, 1] / height, pts[:, 2]])


def main() -> int:
    warnings.filterwarnings("ignore", message=".*InconsistentVersionWarning.*")

    if not CSV_PATH.exists():
        print(f"LEWATI: {CSV_PATH} tidak ada (bahan laporan P2, tidak wajib runtime).")
        return 0
    if not (config.MODEL_DIR / config.MODEL_FILES["mlp"]).exists():
        print(f"GAGAL: model belum ada di {config.MODEL_DIR / config.MODEL_FILES['mlp']}")
        return 1

    service = ModelService()
    loaded = service.load()
    print("model dimuat :", ", ".join(loaded) or "(tidak ada)")
    print("label        :", ", ".join(service._labels))
    if "mlp" not in loaded:
        print("GAGAL: model MLP tidak termuat")
        return 1

    samples = baca_sampel(PER_CLASS)
    benar = 0
    kontrol = 0
    salah = []
    for features, label in samples:
        mediapipe = ke_gaya_mediapipe(features)
        hasil = service.predict(normalize_landmarks(mediapipe, image_size=(640, 480)))
        tebakan = hasil["label"] if hasil else None
        benar += tebakan == label
        if tebakan != label:
            salah.append((label, tebakan))

        langsung = service.predict(features.tolist())
        kontrol += (langsung is not None and langsung["label"] == label)

    total = len(samples)
    print(f"jalur MediaPipe -> features.py -> model : {benar}/{total}")
    print(f"kontrol (fitur CSV langsung ke model)   : {kontrol}/{total}")
    if salah:
        print("salah:", ", ".join(f"{asli}->{tebak}" for asli, tebak in salah[:6]))

    lulus = total > 0 and benar / total >= 0.95
    print("HASIL:", "OK" if lulus else "GAGAL (butuh >= 95%)")
    return 0 if lulus else 1


if __name__ == "__main__":
    raise SystemExit(main())
