"""diag_deteksi.py — ambil frame asli dari /video_feed lalu uji jalur deteksi.

Pakai kamera yang SUDAH dibuka server (lewat stream MJPEG), jadi aman dijalankan
bersamaan dengan backend yang hidup.

    python backend/tools/diag_deteksi.py
    python backend/tools/diag_deteksi.py --frames 8 --tahan 2
"""
from __future__ import annotations

import argparse
import sys
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import config  # noqa: E402
from hand_processor import HandProcessor  # noqa: E402
from hand_tracker import HandTracker  # noqa: E402
from features import normalize_landmarks  # noqa: E402
from model_service import ModelService  # noqa: E402
from smoother import Smoother  # noqa: E402


def ambil_frame(url: str, jumlah: int):
    """Baca stream MJPEG dan kembalikan `jumlah` frame terakhir."""
    with urllib.request.urlopen(url, timeout=30) as response:
        buffer = b""
        hasil = []
        while len(hasil) < jumlah:
            chunk = response.read(65536)
            if not chunk:
                break
            buffer += chunk
            while True:
                mulai = buffer.find(b"\xff\xd8")
                akhir = buffer.find(b"\xff\xd9")
                if mulai == -1 or akhir == -1 or akhir <= mulai:
                    break
                jpeg = buffer[mulai:akhir + 2]
                buffer = buffer[akhir + 2:]
                image = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
                if image is not None:
                    hasil.append(image)
                    if len(hasil) >= jumlah:
                        return hasil
        return hasil


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000/video_feed")
    parser.add_argument("--frames", type=int, default=6)
    parser.add_argument("--tahan", type=float, default=0.0,
                        help="detik menunggu sebelum baca stream (buat siap-siap angkat tangan)")
    parser.add_argument("--simpan", default="", help="folder untuk menyimpan frame mentah")
    args = parser.parse_args()

    if args.tahan:
        print(f"menunggu {args.tahan:.0f} detik — angkat tangan di depan kamera...")
        time.sleep(args.tahan)

    processor = HandProcessor()
    print(f"MediaPipe available={processor.available} mode={processor.mode} "
          f"num_hands={config.MAX_NUM_HANDS} error={processor.last_error or '-'}")
    if not processor.available:
        processor.close()
        return 2

    models = ModelService()
    loaded = models.load()
    print(f"model active={models.active} loaded={loaded}")

    frames = ambil_frame(args.url, args.frames)
    print(f"frame dari /video_feed: {len(frames)}")
    if not frames:
        print("GAGAL: stream kosong — backend-nya nggak kirim gambar")
        processor.close()
        return 1

    if args.simpan:
        Path(args.simpan).mkdir(parents=True, exist_ok=True)
        for i, frame in enumerate(frames):
            cv2.imwrite(str(Path(args.simpan) / f"frame_{i}.jpg"), frame)
        print(f"frame disimpan di {args.simpan}")

    tracker = HandTracker(max_tangan=config.MAX_NUM_HANDS,
                          jarak_maks=config.TRACK_JARAKMAKS,
                          hilang_maks=config.TRACK_HILANG_MAKS)
    smoothers: dict[int, Smoother] = {}

    for i, frame in enumerate(frames):
        detected = processor.process(frame)
        ids = tracker.update([(h[0][0], h[0][1]) for h in detected])
        ringkas = []
        for hand_id, landmarks in zip(ids, detected):
            try:
                fitur = normalize_landmarks(
                    landmarks, image_size=(frame.shape[1], frame.shape[0]))
            except ValueError as exc:
                ringkas.append(f"id{hand_id}:normalize-gagal({exc})")
                continue
            prediksi = models.predict(fitur)
            if prediksi is None:
                ringkas.append(f"id{hand_id}:tanpa-model")
                continue
            smoother = smoothers.setdefault(hand_id, Smoother(threshold=config.CONFIDENCE_THRESHOLD))
            hasil = smoother.update(prediksi["label"], prediksi["confidence"])
            ringkas.append(
                f"id{hand_id}:{hasil['state']}/{hasil['gesture']}"
                f"@{hasil['confidence']:.2f} mentah={prediksi['label']}"
                f"@{prediksi['confidence']:.2f}")
        print(f"frame {i}: tangan={len(detected)} " + (" | ".join(ringkas) or "-"))

    processor.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
