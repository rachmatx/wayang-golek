"""stream.py — ubah frame jadi siaran MJPEG untuk /video_feed."""
from __future__ import annotations

import threading
import time

import config

try:  # pragma: no cover
    import cv2
except Exception:  # pragma: no cover
    cv2 = None


class FrameStream:
    """Menyimpan satu JPEG terbaru. Penonton baru selalu dapat frame terkini."""

    def __init__(self) -> None:
        self._cond = threading.Condition()
        self._jpeg: bytes | None = None
        self._seq = 0

    def push_frame(self, frame) -> bool:
        if cv2 is None or frame is None:
            return False
        try:
            ok, buffer = cv2.imencode(
                ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), config.JPEG_QUALITY]
            )
        except Exception:
            return False
        if not ok:
            return False
        self.push_jpeg(buffer.tobytes())
        return True

    def push_jpeg(self, data: bytes) -> None:
        with self._cond:
            self._jpeg = data
            self._seq += 1
            self._cond.notify_all()

    def latest_after(self, last_seq: int, timeout: float = 1.0) -> tuple[bytes | None, int]:
        with self._cond:
            if self._seq == last_seq:
                self._cond.wait(timeout)
            return self._jpeg, self._seq


frames = FrameStream()


def mjpeg_generator():
    """Generator MJPEG: setiap frame dibungkus boundary multipart."""
    last_seq = -1
    stalls = 0
    while True:
        data, seq = frames.latest_after(last_seq, timeout=1.0)
        if data is None or seq == last_seq:
            # belum ada frame baru. Bila kamera benar-benar berhenti, akhiri
            # siaran supaya browser menampilkan gambar "kamera tidak tersedia".
            stalls += 1
            if stalls >= 5:
                return
            time.sleep(0.02)
            continue
        stalls = 0
        last_seq = seq
        header = (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: " + str(len(data)).encode("ascii") + b"\r\n\r\n"
        )
        yield header + data + b"\r\n"
