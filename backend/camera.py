"""camera.py — buka webcam, ambil frame, mirror, sediakan frame terakhir.

Kalau OpenCV tidak terpasang atau kamera tidak terbuka, modul ini tidak
melempar error: `available` tetap False dan pipeline melapor ke health.
"""
from __future__ import annotations

import logging
import threading

import config

try:  # pragma: no cover - bergantung lingkungan
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

log = logging.getLogger(__name__)


class Camera:
    def __init__(self) -> None:
        self._cap = None
        self._lock = threading.Lock()
        self.available = False
        self.last_error = "" if cv2 is not None else "opencv-python belum terpasang"

    @property
    def cv_available(self) -> bool:
        return cv2 is not None

    def open(self) -> bool:
        if cv2 is None:
            self.last_error = "opencv-python belum terpasang"
            return False

        with self._lock:
            if self._cap is not None:
                return True
            try:
                cap = cv2.VideoCapture(config.CAMERA_INDEX)
                if not cap.isOpened():
                    cap.release()
                    self.last_error = f"kamera index {config.CAMERA_INDEX} tidak terbuka"
                    return False
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.FRAME_WIDTH)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)
                ok, _ = cap.read()
                if not ok:
                    cap.release()
                    self.last_error = "kamera terbuka tapi tidak mengirim frame"
                    return False
            except Exception as exc:  # kamera bisa melempar apa saja di Windows
                self.last_error = f"gagal membuka kamera: {exc}"
                log.warning(self.last_error)
                return False

            self._cap = cap
            self.available = True
            self.last_error = ""
            log.info("kamera siap: index=%s %sx%s", config.CAMERA_INDEX,
                     config.FRAME_WIDTH, config.FRAME_HEIGHT)
            return True

    def read(self):
        """Ambil frame terbaru (BGR, sudah dimirror). None bila gagal."""
        if cv2 is None:
            return None
        with self._lock:
            if self._cap is None:
                return None
            ok, frame = self._cap.read()
        if not ok or frame is None:
            return None
        if config.MIRROR:
            frame = cv2.flip(frame, 1)
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
