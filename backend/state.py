"""state.py — hasil terakhir pipeline (daftar tangan), dibaca app.py.

Pipeline menulis ke sini dari thread-nya sendiri; server membaca dari thread
asyncio. Semua akses lewat lock supaya tidak ada data setengah jadi.

Versi dua tangan: simpanan utamanya daftar `hands`, satu item per tangan yang
terlihat, berisi id tangan dari hand_tracker plus hasil smoothenya.
"""
from __future__ import annotations

import copy
import threading
import time

import config


def _sidik(hands) -> list:
    """Signature yang dianggap 'berubah'.

    Confidence sengaja tidak ikut dibandingkan: angkanya bergerak tiap frame
    dan akan memaksa WebSocket mengirim ulang terus-menerus, padahal yang
    dibutuhkan frontend cuma gestur, state, dan posisi tangan.
    """
    return [
        (
            int(hand["id"]),
            hand["state"],
            hand["gesture"],
            round(float(hand["wrist_x"]), 3),
            round(float(hand["wrist_y"]), 3),
        )
        for hand in hands
    ]


class StateStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._version = 0
        self._hands: list[dict] = []
        self._meta = {
            "model": config.DEFAULT_MODEL,
            "model_loaded": False,
            "camera": False,
            "camera_index": config.CAMERA_INDEX,
            "camera_aktif": True,
            "fps": 0.0,
        }
        self._updated_at = 0.0

    def update(self, hands, **meta) -> bool:
        """Ganti daftar tangan + setelan. Kembalikan True bila ada yang berubah."""
        with self._lock:
            changed = _sidik(hands) != _sidik(self._hands)
            self._hands = hands
            for key, value in meta.items():
                if key in self._meta and self._meta[key] != value:
                    self._meta[key] = value
                    changed = True
            self._updated_at = time.time()
            if changed:
                self._version += 1
            return changed

    def set_model(self, name: str, loaded: bool) -> None:
        self.update(self._hands_snapshot(), model=name, model_loaded=bool(loaded))

    def set_camera(self, ok: bool) -> None:
        self.update(self._hands_snapshot(), camera=bool(ok))

    def _hands_snapshot(self) -> list:
        with self._lock:
            return copy.deepcopy(self._hands)

    def snapshot(self) -> tuple[dict, int]:
        with self._lock:
            data = dict(self._meta)
            data["hands"] = copy.deepcopy(self._hands)
            data["updated_at"] = self._updated_at
            return data, self._version

    def reset(self) -> None:
        """Panggung kosong: tidak ada tangan yang sedang dipegang."""
        self.update([])

    def health(self) -> dict:
        with self._lock:
            data = self._meta
            return {
                "status": "ok",
                "camera": bool(data["camera"]),
                "camera_index": int(data["camera_index"]),
                "camera_aktif": bool(data["camera_aktif"]),
                "model": data["model"],
                "model_loaded": bool(data["model_loaded"]),
                "fps": round(float(data["fps"]), 1),
                "hands": len(self._hands),
            }


store = StateStore()
