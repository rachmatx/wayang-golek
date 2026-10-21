"""Uji model_service dengan model tiruan (tanpa berkas P2).

Melatih classifier kecil di memori, menyimpannya ke folder sementara, lalu
memastikan backend bisa memuat, memilih model, dan mengembalikan top-3.

    python backend/tools/test_model_service.py
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import joblib  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402

import config  # noqa: E402
from model_service import ModelService  # noqa: E402

KELAS = ["telapak_terbuka", "kepalan", "telunjuk", "dua_jari", "jempol", "ok"]
GAGAL = 0


def cek(nama: str, kondisi: bool) -> None:
    global GAGAL
    print(f"[{'OK  ' if kondisi else 'GAGAL'}] {nama}")
    if not kondisi:
        GAGAL += 1


def main() -> int:
    rng = np.random.default_rng(42)
    fitur = rng.normal(size=(120, config.FEATURE_COUNT))
    target = np.repeat(np.arange(len(KELAS)), 20)
    classifier = LogisticRegression(max_iter=2000).fit(fitur, target)

    with tempfile.TemporaryDirectory() as folder:
        model_dir = Path(folder)
        joblib.dump({"model": classifier, "labels": KELAS}, model_dir / "model_mlp.pkl")
        (model_dir / "labels.json").write_text(json.dumps(KELAS), encoding="utf-8")

        config.MODEL_DIR = model_dir
        config.LABELS_PATH = model_dir / "labels.json"

        service = ModelService()
        loaded = service.load()
        cek("model tiruan dimuat", loaded == ["mlp"] and service.is_loaded)
        cek("model aktif default = mlp", service.active == "mlp")
        cek("model rf yang tidak ada ditolak", service.set_active("rf") is False)

        hasil = service.predict(list(fitur[0]))
        cek("prediksi mengembalikan label", bool(hasil and hasil["label"] in KELAS))
        cek("top-3 berisi 3 baris", bool(hasil and len(hasil["top3"]) == 3))
        cek("confidence 0..1",
            bool(hasil and 0.0 <= hasil["confidence"] <= 1.0))

        kosong = ModelService()
        config.MODEL_DIR = model_dir / "tidak-ada"
        kosong.load()
        cek("tanpa berkas model -> predict None", kosong.predict(list(fitur[0])) is None)
        cek("tanpa berkas model -> is_loaded False", kosong.is_loaded is False)

    print()
    if GAGAL:
        print(f"{GAGAL} pemeriksaan GAGAL")
        return 1
    print("semua pemeriksaan lolos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
