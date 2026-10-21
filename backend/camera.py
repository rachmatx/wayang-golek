"""camera.py — buka webcam, ambil frame, mirror, sediakan frame terakhir.

Kalau OpenCV tidak terpasang atau kamera tidak terbuka, modul ini tidak
melempar error: `available` tetap False dan pipeline melapor ke health.

Dua hal yang membedakan kamera dari sumber data biasa: device-nya exclusive
(hanya satu pemegang) dan "berhasil dibuka" belum berarti gambarnya bermakna.
Karena itu ada `aktif` (niat user: kamera boleh dipakai atau tidak),
`ganti_index()` (pindah sumber tanpa restart), dan `cek_sinyal()` (vonis
apakah frame-nya gambar sungguhan).
"""
from __future__ import annotations

import logging
import threading

import config

try:  # pragma: no cover - bergantung lingkungan
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:  # pragma: no cover - numpy wajib, tapi jangan sampai impor ini mematikan app
    import numpy as np
except Exception:  # pragma: no cover
    np = None

log = logging.getLogger(__name__)


def cek_sinyal(frame, referensi=None, min_std: float = config.SINYAL_MIN_STD,
               max_selisih: float = config.SINYAL_MAX_SELISIH,
               contoh: int = config.SINYAL_CONTOH) -> tuple[bool, str]:
    """Vonis satu frame: (bagus, alasan). Kosong alasan berarti bagus.

    Dua kegagalan yang paling sering terjadi di mesin nyata: kamera yang
    macet pada satu gambar (hitam/beku) dan kamera virtual yang mengirim
    static noise. Yang pertama ketahuan dari kontrasnya yang hilang, yang
    kedua dari lonjakan antar frame — kamera sungguhan tidak mengubah setiap
    pixel sebesar itu dalam 1/20 detik.
    """
    if frame is None:
        return False, "kamera tidak mengirim frame"
    if np is None:
        return True, ""

    langkah = max(1, int(contoh))
    saring = frame[::langkah, ::langkah]
    if float(saring.std()) < float(min_std):
        return False, "gambar beku atau hitam"

    if referensi is not None:
        banding = referensi[::langkah, ::langkah]
        if banding.shape == saring.shape:
            selisih = float(np.abs(saring.astype(np.int16)
                                   - banding.astype(np.int16)).mean())
            if selisih > float(max_selisih):
                return False, "noise: gambar berubah ekstrem tiap frame"

    return True, ""


class Camera:
    def __init__(self, cv=None, index=None) -> None:
        self._cv = cv2 if cv is None else cv
        self._cap = None
        self._lock = threading.Lock()
        self.index = int(config.CAMERA_INDEX if index is None else index)
        self.aktif = True
        self.available = False
        self.lebar = 0
        self.tinggi = 0
        self.last_error = "" if self._cv is not None else "opencv-python belum terpasang"

    @property
    def cv_available(self) -> bool:
        return self._cv is not None

    @property
    def cv(self):
        """Modul cv2 yang dipakai objek ini — dibutuhkan endpoint daftar kamera."""
        return self._cv

    def info(self) -> dict:
        return {"index": self.index, "lebar": self.lebar, "tinggi": self.tinggi}

    def open(self) -> bool:
        cv = self._cv
        if cv is None:
            self.last_error = "opencv-python belum terpasang"
            return False

        with self._lock:
            if self._cap is not None:
                return True
            try:
                cap = cv.VideoCapture(self.index)
                if not cap.isOpened():
                    cap.release()
                    self.last_error = f"kamera index {self.index} tidak terbuka"
                    return False
                cap.set(cv.CAP_PROP_FRAME_WIDTH, config.FRAME_WIDTH)
                cap.set(cv.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)
                ok, _ = cap.read()
                if not ok:
                    cap.release()
                    self.last_error = (f"kamera index {self.index} terbuka "
                                       "tapi tidak mengirim frame")
                    return False
                self.lebar = int(cap.get(cv.CAP_PROP_FRAME_WIDTH) or config.FRAME_WIDTH)
                self.tinggi = int(cap.get(cv.CAP_PROP_FRAME_HEIGHT) or config.FRAME_HEIGHT)
            except Exception as exc:  # kamera bisa melempar apa saja di Windows
                self.last_error = f"gagal membuka kamera: {exc}"
                log.warning(self.last_error)
                return False

            self._cap = cap
            self.available = True
            self.last_error = ""
            log.info("kamera siap: index=%s %sx%s", self.index, self.lebar, self.tinggi)
            return True

    def nyalakan(self, hidup: bool) -> bool:
        """Niat user: False melepas device supaya aplikasi lain bisa memakainya."""
        self.aktif = bool(hidup)
        if not self.aktif:
            self.close()
            return False
        return self.open()

    def ganti_index(self, index: int) -> bool:
        """Pindah sumber kamera tanpa restart. Gagal = kamera lama tetap jalan."""
        index = int(index)
        if index == self.index and self.available:
            return True
        lama = self.index
        self.close()
        self.index = index
        if self.open():
            return True
        # Alasan kegagalan harus bertahan: kamera lama dipulihkan dan open()
        # yang sukses menghapus last_error, padahal frontend perlu tahu index
        # mana yang ditolak dan kenapa.
        alasan = self.last_error
        self.index = lama
        self.open()
        self.last_error = alasan
        return False

    def read(self):
        """Ambil frame terbaru (BGR, sudah dimirror). None bila gagal."""
        if self._cv is None:
            return None
        with self._lock:
            if self._cap is None:
                return None
            ok, frame = self._cap.read()
        if not ok or frame is None:
            return None
        if config.MIRROR:
            frame = self._cv.flip(frame, 1)
        return frame

    def close(self) -> None:
        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                except Exception:
                    pass
            self._cap = None
            self.available = False
