"""Uji kendali kamera: daftar sumber, on/off, dan guard sinyal — tanpa webcam.

Jalankan:  python backend/tools/test_kamera.py

Kenapa tes ini ada: tombol on/off dan pemilih sumber kamera menyentuh perangkat
yang tidak bisa dipinjam ke proses lain (webcam bersifat exclusive, dan di mesin
ini index 0 malah mengirim static noise). Jadi semua keputusan logikanya —
index mana dianggap ada, kapan kamera dianggap tidak mengirim gambar bermakna,
dan apakah pipeline menghormati niat user — harus terbukti lewat cv2 dan frame
tiruan, bukan lewat mata orang.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import cameras  # noqa: E402
import config  # noqa: E402
import pipeline as pipeline_mod  # noqa: E402
import state as state_mod  # noqa: E402
from camera import Camera, cek_sinyal  # noqa: E402

GAGAL = 0


def cek(nama: str, kondisi: bool) -> None:
    global GAGAL
    tanda = "OK  " if kondisi else "GAGAL"
    print(f"[{tanda}] {nama}")
    if not kondisi:
        GAGAL += 1


# --------------------------------------------------------------------------
# cv2 tiruan
# --------------------------------------------------------------------------
class _Cap:
    def __init__(self, index, perilaku):
        p = perilaku.get(index, {})
        self._opened = bool(p.get("opened", False))
        self._read = bool(p.get("read", False))
        self._lebar = int(p.get("lebar", 0))
        self._tinggi = int(p.get("tinggi", 0))
        self.dilepas = False

    def isOpened(self):
        return self._opened

    def read(self):
        return (self._read, None)

    def get(self, properti):
        if properti == "W":
            return float(self._lebar)
        if properti == "H":
            return float(self._tinggi)
        return 0.0

    def set(self, _properti, _nilai):
        return True

    def release(self):
        self.dilepas = True
        self._opened = False


class _Cv:
    """Hanya bagian VideoCapture + properti resolusi yang dipakai kamera."""

    CAP_PROP_FRAME_WIDTH = "W"
    CAP_PROP_FRAME_HEIGHT = "H"

    def __init__(self, perilaku):
        self.perilaku = perilaku
        self.dipanggil = []
        self.cap = []

    def VideoCapture(self, index, *_sisa):
        self.dipanggil.append(index)
        cap = _Cap(index, self.perilaku)
        self.cap.append(cap)
        return cap


PERILAKU = {
    0: {"opened": True, "read": True, "lebar": 640, "tinggi": 480},
    1: {"opened": True, "read": True, "lebar": 1280, "tinggi": 720},
    2: {},
    3: {},
    4: {"opened": True, "read": False},
}


# --------------------------------------------------------------------------
# 1. daftar sumber kamera
# --------------------------------------------------------------------------
def uji_daftar_kamera() -> None:
    cv = _Cv(PERILAKU)
    hasil = cameras.daftar_kamera(cv, jumlah_maks=6, henti_setelah_gagal=2)

    cek("hanya index yang dipanggil sampai dua kosong beruntun",
        cv.dipanggil == [0, 1, 2, 3])
    cek("daftar berisi empat item", len(hasil) == 4)
    cek("index 0 tersedia dengan resolusinya",
        hasil[0]["tersedia"] and hasil[0]["lebar"] == 640 and hasil[0]["tinggi"] == 480)
    cek("index 1 beda resolusi jadi bisa dibedakan",
        hasil[1]["tersedia"] and hasil[1]["lebar"] == 1280)
    cek("pemberhentian dini: index 4 tidak ikut dipindai",
        4 not in [i["index"] for i in hasil])

    cek("label kamera tersedia menyebut resolusinya",
        hasil[0]["label"] == "Kamera 0 — 640×480")
    cek("label kamera mati bilang tidak terbaca",
        hasil[2]["label"] == "Kamera 2 — tidak terbaca")
    cek("alasan kosong untuk kamera yang sehat",
        hasil[1]["alasan"] == "")


def uji_daftar_melewati_kamera_yang_dipegang() -> None:
    cv = _Cv(PERILAKU)
    aktif = {"index": 0, "lebar": 640, "tinggi": 480}
    hasil = cameras.daftar_kamera(cv, aktif=aktif, jumlah_maks=6,
                                  henti_setelah_gagal=2)

    cek("index yang sedang dipegang tidak dipindai ulang",
        0 not in cv.dipanggil)
    cek("index aktif ditandai aktif", hasil[0]["aktif"] is True)
    cek("index aktif tetap tersedia walau tidak dipindai",
        hasil[0]["tersedia"] and hasil[0]["lebar"] == 640)
    cek("label index aktif ada tanda aktifnya",
        hasil[0]["label"].endswith("(aktif)"))


def uji_cache_daftar() -> None:
    cameras.lupakan()
    cv = _Cv(PERILAKU)
    pertama = cameras.ambil(cv, jumlah_maks=6, henti_setelah_gagal=2)
    kedua = cameras.ambil(cv, jumlah_maks=6, henti_setelah_gagal=2)
    cek("panggilan kedua pakai cache, tidak memindai lagi",
        len(cv.dipanggil) == len(pertama))
    cek("isi cache sama dengan hasil pertama", kedua == pertama)

    cameras.ambil(cv, paksa=True, jumlah_maks=6, henti_setelah_gagal=2)
    cek("paksa=True memindai ulang", len(cv.dipanggil) > len(pertama))
    cameras.lupakan()


# --------------------------------------------------------------------------
# 2. guard sinyal kamera
# --------------------------------------------------------------------------
def uji_cek_sinyal() -> None:
    beku = np.zeros((480, 640, 3), dtype=np.uint8)
    ok, alasan = cek_sinyal(beku)
    cek("frame seragam dianggap bukan sinyal", ok is False and "beku" in alasan)

    nyata = np.tile(np.linspace(20, 200, 640, dtype=np.uint8), (480, 3))
    ok, alasan = cek_sinyal(nyata, referensi=nyata)
    cek("gambar terang yang diam masih sinyal sah", ok is True and alasan == "")

    rng = np.random.default_rng(7)
    noise = rng.integers(0, 255, size=(480, 640, 3), dtype=np.uint8)
    noise2 = rng.integers(0, 255, size=(480, 640, 3), dtype=np.uint8)
    ok, alasan = cek_sinyal(noise, referensi=noise2)
    cek("static noise tertangkap dari lonjakan antar frame",
        ok is False and "noise" in alasan)

    ok, _ = cek_sinyal(noise)
    cek("frame pertama tanpa referensi tidak langsung divonis noise",
        ok is True)

    kecil = np.full((480, 640, 3), 7, dtype=np.uint8)
    ok, alasan = cek_sinyal(kecil)
    cek("kamera hitam pekat tertangkap juga", ok is False)


# --------------------------------------------------------------------------
# 3. objek Camera: index + on/off
# --------------------------------------------------------------------------
def uji_camera_objek() -> None:
    cv = _Cv(PERILAKU)
    cam = Camera(cv=cv, index=0)
    cek("mulai dalam keadaan aktif", cam.aktif is True and cam.index == 0)

    cek("open index 0 berhasil", cam.open() is True)
    cek("available ikut naik", cam.available is True)
    info = cam.info()
    cek("info memberi index dan resolusi",
        info == {"index": 0, "lebar": 640, "tinggi": 480})

    cek("ganti ke index 1 berhasil", cam.ganti_index(1) is True)
    cek("index baru tercatat", cam.index == 1 and cam.available is True)
    cek("device lama dilepas", cv.cap[0].dilepas is True)

    cek("ganti ke index mati ditolak", cam.ganti_index(2) is False)
    cek("index tidak berubah saat gagal", cam.index == 1)
    cek("kamera lama tetap jalan setelah ganti gagal", cam.available is True)
    cek("alasan kegagalan tercatat", "2" in cam.last_error)

    cek("nyalakan(False) melepas device", cam.nyalakan(False) is False)
    cek("flag niat user tetap tersimpan", cam.aktif is False)
    cek("available mati", cam.available is False)
    cek("read saat mati mengembalikan None", cam.read() is None)

    cek("nyalakan(True) membuka lagi", cam.nyalakan(True) is True)
    cek("yang dibuka adalah index terakhir", cam.index == 1)


# --------------------------------------------------------------------------
# 4. pipeline: hormati on/off + buang noise
# --------------------------------------------------------------------------
class CameraStub:
    cv_available = True
    last_error = ""

    def __init__(self, frame=None, aktif=True, index=0) -> None:
        self.frame = frame
        self.aktif = aktif
        self.index = index
        self.dibuka = 0
        self.ditutup = 0
        self.available = aktif

    def open(self):
        self.dibuka += 1
        self.available = True
        return True

    def read(self):
        return self.frame() if callable(self.frame) else self.frame

    def close(self):
        self.ditutup += 1
        self.available = False

    def info(self):
        return {"index": self.index, "lebar": 640, "tinggi": 480}


class ProcessorStub:
    available = True
    mode = "stub"

    def process(self, _frame):
        return []

    def close(self):
        pass


class ModelsStub:
    active = "stub"
    is_loaded = True

    def predict(self, _features):
        return None


GRADIENT = np.tile(np.linspace(20, 200, 640, dtype=np.uint8), (480, 3))


def buat_pipeline(camera):
    state_mod.store.reset()
    return pipeline_mod.Pipeline(camera=camera, processor=ProcessorStub(),
                                 models=ModelsStub())


def uji_pipeline_matikan_kamera() -> None:
    cam = CameraStub(frame=GRADIENT, aktif=False)
    p = buat_pipeline(cam)
    for _ in range(6):
        p._tick()

    sehat = state_mod.store.health()
    cek("kamera yang dimatikan user melapor camera False", sehat["camera"] is False)
    cek("pipeline tidak mencoba membuka kamera yang dimatikan user",
        cam.dibuka == 0)
    cek("tidak ada tangan saat kamera mati", sehat["hands"] == 0)
    cek("health membawa index dan niat kamera",
        sehat["camera_aktif"] is False and sehat["camera_index"] == 0)

    cam.aktif = True
    p._tick()
    cek("setelah dinyalakan lagi pipeline membaca frame",
        state_mod.store.health()["camera"] is True)


def uji_pipeline_guard_noise() -> None:
    rng = np.random.default_rng(11)
    cam = CameraStub(frame=lambda: rng.integers(0, 255, size=(480, 640, 3),
                                                dtype=np.uint8))
    p = buat_pipeline(cam)
    for _ in range(config.SINYAL_BATAS_FRAME):
        p._tick()
    cek("sebelum batas, kamera masih dianggap hidup",
        state_mod.store.health()["camera"] is True)
    cek("device belum dilepas sebelum batas", cam.ditutup == 0)

    p._tick()
    sehat = state_mod.store.health()
    cek("setelah batas frame tanpa sinyal, kamera ditutup", cam.ditutup == 1)
    cek("health melapor kamera mati", sehat["camera"] is False)
    cek("alasan sinyal tercatat untuk hint frontend",
        "noise" in cam.last_error or "beku" in cam.last_error)
    cek("niat user tidak berubah: kamera masih harusnya nyala",
        cam.aktif is True)

    bersih = buat_pipeline(CameraStub(frame=GRADIENT))
    for _ in range(config.SINYAL_BATAS_FRAME + 5):
        bersih._tick()
    cek("frame sah tidak pernah memicu guard",
        state_mod.store.health()["camera"] is True)


if __name__ == "__main__":
    uji_daftar_kamera()
    uji_daftar_melewati_kamera_yang_dipegang()
    uji_cache_daftar()
    uji_cek_sinyal()
    uji_camera_objek()
    uji_pipeline_matikan_kamera()
    uji_pipeline_guard_noise()
    print()
    if GAGAL:
        print(f"{GAGAL} pemeriksaan GAGAL")
        raise SystemExit(1)
    print("semua pemeriksaan lolos")
