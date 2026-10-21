"""diag_pipeline.py — jalankan Pipeline server yang asli, tapi kameranya
diganti dengan frame hasil diag_deteksi.py dari /video_feed.

Menguji jalur server apa adanya (thread pipeline -> processor -> tracker ->
smoother -> state -> protocol) tanpa merebut kamera dari server yang hidup.

    python backend/tools/diag_deteksi.py --tahan 12 --frames 20 --simpan diag_frame
    python backend/tools/diag_pipeline.py
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import cv2

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

logging.basicConfig(level=logging.DEBUG, format="%(levelname)-7s %(name)-18s %(message)s")

import protocol  # noqa: E402
import state as state_mod  # noqa: E402
import pipeline as pipeline_mod  # noqa: E402

ROOT = BACKEND.parent


class KameraTiru:
    """Camera stub: read() mengembalikan frame berurutan, diulang."""

    def __init__(self, frames) -> None:
        self._frames = frames
        self._i = 0
        self.available = True
        self.cv_available = True
        self.last_error = "stub"

    def read(self):
        frame = self._frames[self._i % len(self._frames)]
        self._i += 1
        return frame

    def open(self) -> bool:
        return True

    def close(self) -> None:
        pass


def main() -> int:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "diag_frame"
    frames = [image for p in sorted(folder.glob("frame_*.jpg"))
              if (image := cv2.imread(str(p))) is not None]
    if not frames:
        print(f"tidak ada frame jpg di {folder} — jalankan diag_deteksi.py --simpan dulu")
        return 1
    print(f"{len(frames)} frame dari {folder}, ukuran {frames[0].shape}", flush=True)

    pip = pipeline_mod.Pipeline(camera=KameraTiru(frames))
    print(f"processor: available={pip.processor.available} mode={pip.processor.mode} "
          f"error={pip.processor.last_error or '-'}", flush=True)
    pip.start()

    terisi = 0
    akhir = time.monotonic() + 4.0
    while time.monotonic() < akhir:
        snapshot, _versi = state_mod.store.snapshot()
        pesan = protocol.prediction_message(snapshot)
        if pesan["hands"]:
            terisi += 1
            if terisi % 8 == 1:
                ringkas = ", ".join(
                    f"id{h['id']}:{h['state']}/{h['gesture']}@{h['confidence']:.2f}"
                    for h in pesan["hands"])
                print(f"  WS hands: {ringkas}", flush=True)
        time.sleep(0.02)

    pip.stop()
    time.sleep(0.3)
    print(f"pesan berisi hands: {terisi}", flush=True)
    if not terisi:
        print("REPRODUCED: pipeline server tidak menghasilkan tangan "
              "padahal frame-nya sama persis", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
