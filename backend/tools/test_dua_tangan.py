"""Uji wiring dua tangan di pipeline — tanpa kamera, tanpa model asli.

Jalankan:  python backend/tools/test_dua_tangan.py

Kenapa tes ini ada: hand_tracker dan bentuk pesan sudah diuji test_logika.py,
tapi masih ada pertanyaan yang cuma bisa dijawab dengan menjalankan pipeline:
kalau dua tangan menampilkan gestur BERBEDA, apakah keduanya benar-benar
menghasilkan dua laporan terpisah, atau gestur tangan A malah kebawa ke wayang
milik tangan B.
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
import pipeline as pipeline_mod  # noqa: E402
import state as state_mod  # noqa: E402

# Bukan frame hitam: guard sinyal (cek_sinyal) menolak gambar tanpa kontras,
# jadi stub harus mengirim gambar yang kelihatan seperti hasil kamera sungguhan.
FRAME = np.tile(np.linspace(20, 200, 640, dtype=np.uint8), (480, 3))
GAGAL = 0


def cek(nama: str, kondisi: bool) -> None:
    global GAGAL
    tanda = "OK  " if kondisi else "GAGAL"
    print(f"[{tanda}] {nama}")
    if not kondisi:
        GAGAL += 1


def tangan(x_wrist: float, jari: float = 0.0):
    """21 landmark sintetis. `jari` mengangkat satu jari -> gestur 'ok'."""
    landmarks = [(x_wrist, 0.5, 0.0)] * 21
    landmarks[9] = (x_wrist + 0.05, 0.5, 0.0)
    landmarks[8] = (x_wrist + 0.05, 0.5 - jari, 0.0)
    return landmarks


class ModelsStub:
    """Model palsu: bentuk tangan menentukan label, posisinya tidak."""

    active = "stub"
    is_loaded = True

    def predict(self, features):
        # features[25] = y landmark 8 setelah normalisasi (negatif = terangkat).
        label = "ok" if features[25] < -0.05 else "kepalan"
        return {"label": label, "confidence": 0.9, "top3": [[label, 0.9]]}


class ProcessorStub:
    available = True
    mode = "stub"

    def __init__(self, daftar) -> None:
        self.daftar = daftar

    def process(self, frame):
        return list(self.daftar())

    def close(self) -> None:
        pass


class CameraStub:
    available = True
    cv_available = True
    last_error = ""

    def read(self):
        return FRAME

    def close(self) -> None:
        pass


def buat_pipeline(daftar):
    state_mod.store.reset()
    return pipeline_mod.Pipeline(camera=CameraStub(),
                                 processor=ProcessorStub(daftar),
                                 models=ModelsStub())


def hands(pipeline):
    snapshot, _ = state_mod.store.snapshot()
    return snapshot["hands"]


def jalankan(pipeline, jumlah: int) -> None:
    for _ in range(jumlah):
        pipeline._tick()


_FRAME_PANJANG = config.SMOOTHING_WINDOW + config.MIN_HOLD_FRAMES


def uji_dua_tangan_dua_label() -> None:
    p = buat_pipeline(lambda: [tangan(0.2, jari=0.01), tangan(0.8)])
    jalankan(p, _FRAME_PANJANG)
    hasil = hands(p)
    cek("dua tangan -> dua item hands", len(hasil) == 2)
    cek("id kedua tangan berbeda", len({h["id"] for h in hasil}) == 2)
    cek("gestur kedua tangan terpisah (ok + kepalan)",
        {h["gesture"] for h in hasil} == {"ok", "kepalan"})
    cek("state kedua tangan ok", all(h["state"] == "ok" for h in hasil))
    cek("wrist dikirim per tangan",
        sorted(round(h["wrist_x"], 1) for h in hasil) == [0.2, 0.8])


def uji_id_tetap_walau_urutan_tukar() -> None:
    p = buat_pipeline(lambda: [tangan(0.2, jari=0.01), tangan(0.8)])
    jalankan(p, 4)
    sebelum = {round(h["wrist_x"], 1): h["id"] for h in hands(p)}

    # MediaPipe menukar urutan laporan: tangan kanan lebih dulu.
    p.processor = ProcessorStub(lambda: [tangan(0.8), tangan(0.2, jari=0.01)])
    jalankan(p, 4)
    sesudah = {round(h["wrist_x"], 1): h["id"] for h in hands(p)}
    cek("id menempel ke posisi tangan, bukan ke urutan laporan",
        sebelum == sesudah)


def uji_tangan_berhenti_terlihat() -> None:
    p = buat_pipeline(lambda: [tangan(0.2), tangan(0.8)])
    jalankan(p, 4)
    id_kanan = {round(h["wrist_x"], 1): h["id"] for h in hands(p)}[0.8]

    p.processor = ProcessorStub(lambda: [tangan(0.2)])
    jalankan(p, config.TRACK_HILANG_MAKS + 2)
    hasil = hands(p)
    cek("tangan kedua tidak lagi dikirim", len(hasil) == 1)
    cek("smoother tangan yang hilang ikut dibuang", len(p._smoothers) == 1)

    p.processor = ProcessorStub(lambda: [])
    jalankan(p, 2)
    cek("tidak ada tangan -> hands kosong", hands(p) == [])
    cek("smoother tetap disimpan sebentar kalau tangan cuma kedip",
        len(p._smoothers) == 1)

    jalankan(p, config.TRACK_HILANG_MAKS)
    cek("smoother dibuang setelah tangan hilang cukup lama",
        p._smoothers == {})

    p.processor = ProcessorStub(lambda: [tangan(0.8)])
    jalankan(p, 4)
    cek("tangan yang datang lagi dapat id baru, bukan id lama",
        hands(p)[0]["id"] != id_kanan)


def uji_version_tidak_naik_terus() -> None:
    p = buat_pipeline(lambda: [tangan(0.2)])
    jalankan(p, _FRAME_PANJANG)
    _, versi_awal = state_mod.store.snapshot()
    jalankan(p, _FRAME_PANJANG)
    _, versi_tetap = state_mod.store.snapshot()
    cek("tangan diam -> versi tidak naik tiap frame", versi_awal == versi_tetap)

    p.processor = ProcessorStub(lambda: [tangan(0.35)])
    jalankan(p, 1)
    _, versi_bergeser = state_mod.store.snapshot()
    cek("tangan bergeser -> versi naik", versi_bergeser > versi_tetap)


if __name__ == "__main__":
    uji_dua_tangan_dua_label()
    uji_id_tetap_walau_urutan_tukar()
    uji_tangan_berhenti_terlihat()
    uji_version_tidak_naik_terus()
    print()
    if GAGAL:
        print(f"{GAGAL} pemeriksaan GAGAL")
        raise SystemExit(1)
    print("semua pemeriksaan dua tangan lolos")
