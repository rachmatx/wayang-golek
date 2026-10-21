"""Unduh berkas model HandLandmarker untuk MediaPipe 1.x (API tasks).

MediaPipe 0.10.x tidak butuh berkas ini; MediaPipe 1.x butuh.
Berkas sudah disertakan di backend/assets/, jadi skrip ini hanya jaring
pengaman kalau berkasnya terhapus.

    python backend/tools/download_hand_model.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402


def main() -> int:
    path = config.HAND_MODEL_PATH
    if path.exists() and path.stat().st_size > 1_000_000:
        print(f"model pelacak tangan sudah ada: {path} ({path.stat().st_size // 1024} KB)")
        return 0

    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"mengunduh {config.HAND_MODEL_URL} ...")
    try:
        urllib.request.urlretrieve(config.HAND_MODEL_URL, path)
    except Exception as exc:
        print(f"GAGAL mengunduh: {exc}")
        print("Unduh manual lalu taruh di:", path)
        return 1

    print(f"tersimpan: {path} ({path.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
