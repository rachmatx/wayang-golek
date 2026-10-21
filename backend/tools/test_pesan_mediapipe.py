"""Uji: kegagalan MediaPipe harus kelihatan di log, tapi tidak membanjiri.

Jalankan:  python backend/tools/test_pesan_mediapipe.py

Kenapa tes ini ada: waktu fitur dua tangan diuji di laptop user, wayang diam
total dan console tetap bersih. Penyebabnya: exception inference MediaPipe
dicatat pakai log.debug, sementara server jalan di level INFO. "Model mati"
dan "tidak ada tangan di kamera" jadi tidak bisa dibedakan — gw butuh tiga
alat diagnostik buat nyimpulkan itu.
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import hand_processor  # noqa: E402
from hand_processor import HandProcessor  # noqa: E402

FRAME = np.zeros((480, 640, 3), dtype=np.uint8)
GAGAL = 0


def cek(nama: str, kondisi: bool) -> None:
    global GAGAL
    tanda = "OK  " if kondisi else "GAGAL"
    print(f"[{tanda}] {nama}")
    if not kondisi:
        GAGAL += 1


class TugasPalsu:
    """Stand-in HandLandmarker yang inference-nya selalu meledak."""

    def __init__(self, pesan: str = "TFLite delegate mati") -> None:
        self.pesan = pesan
        self.panggilan = 0

    def detect_for_video(self, image, stamp):
        self.panggilan += 1
        raise RuntimeError(self.pesan)

    def close(self) -> None:
        pass


class PenangkapLog(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.peringatan = []

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.WARNING:
            self.peringatan.append(record.getMessage())


def tangkap_log():
    penangkap = PenangkapLog()
    log = logging.getLogger("hand_processor")
    lama = log.level
    log.setLevel(logging.DEBUG)
    log.addHandler(penangkap)
    return penangkap, log, lama


def processor_rusak(tugas) -> HandProcessor:
    p = HandProcessor()
    p.available = True
    p._hands = None       # paksa jalur tasks
    p._tasks = tugas
    return p


def uji_kegagalan_terlihat() -> None:
    if hand_processor.cv2 is None:
        print("[SKIP] opencv tidak terpasang — tes log MediaPipe dilewati")
        return
    p = processor_rusak(TugasPalsu())
    penangkap, log, lama = tangkap_log()
    try:
        hasil = p.process(FRAME)
        cek("frame rusak -> hasil kosong, bukan crash", hasil == [])
        cek("kegagalan dicatat di level WARNING (bukan debug)",
            any("delegate mati" in pesan for pesan in penangkap.peringatan))
        cek("kegagalan juga tercatat di last_error untuk /api/health",
            "delegate mati" in p.last_error)
        p.close()
    finally:
        log.setLevel(lama)
        log.removeHandler(penangkap)


def uji_log_tidak_dibanjiri() -> None:
    if hand_processor.cv2 is None:
        return
    tugas = TugasPalsu()
    p = processor_rusak(tugas)
    penangkap, log, lama = tangkap_log()
    try:
        for _ in range(60):
            p.process(FRAME)
        cek("inference tetap dicoba tiap frame", tugas.panggilan == 60)
        cek("60 kegagalan beruntun -> 1 baris log",
            len(penangkap.peringatan) == 1)

        # Setelah jeda lewat, kegagalan berikutnya harus lapor lagi.
        p._gagal_terakhir = 0.0
        p.process(FRAME)
        cek("setelah jeda, kegagalan dilaporkan lagi",
            len(penangkap.peringatan) == 2)
    finally:
        log.setLevel(lama)
        log.removeHandler(penangkap)


def uji_pulih_lapor_beres() -> None:
    """Setelah inference hidup lagi, kondisi pulih harus terlihat sekali."""
    if hand_processor.cv2 is None:
        return
    p = processor_rusak(TugasPalsu())
    penangkap, log, lama = tangkap_log()
    try:
        p.process(FRAME)
        p._proses_pulih()
        cek("pulih tercatat sebagai peringatan (bukan error baru)",
            any("pulih" in pesan.lower() for pesan in penangkap.peringatan))
        p.close()
    finally:
        log.setLevel(lama)
        log.removeHandler(penangkap)


if __name__ == "__main__":
    mulai = time.monotonic()
    uji_kegagalan_terlihat()
    uji_log_tidak_dibanjiri()
    uji_pulih_lapor_beres()
    print(f"\n({time.monotonic() - mulai:.1f}s)")
    if GAGAL:
        print(f"{GAGAL} pemeriksaan GAGAL")
        raise SystemExit(1)
    print("semua pemeriksaan log MediaPipe lolos")
