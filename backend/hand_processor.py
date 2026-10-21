"""hand_processor.py — MediaPipe: frame -> 21 landmark (atau 'tidak ada tangan').

Mendukung dua wajah API MediaPipe, dipilih otomatis:
  1. API lama `mp.solutions.hands` (MediaPipe 0.10.x)  -> mode "solutions"
  2. API baru `mediapipe.tasks` HandLandmarker (MediaPipe 1.x) -> mode "tasks"
     butuh berkas backend/assets/hand_landmarker.task (sudah disertakan).

Tanpa MediaPipe, modul ini tetap bisa diimpor; `available` False dan proses
selalu mengembalikan None.
"""
from __future__ import annotations

import logging
import time

import config

try:  # pragma: no cover
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:  # pragma: no cover
    import mediapipe as mp
except Exception:  # pragma: no cover
    mp = None

log = logging.getLogger(__name__)

# Jeda antar baris log untuk kegagalan MediaPipe yang berkelanjutan.
GAGAL_LOG_JEDA = 5.0


class HandProcessor:
    def __init__(self) -> None:
        self.available = False
        self.mode = "none"
        self.last_error = ""
        self._hands = None       # mode solutions
        self._tasks = None       # mode tasks
        self._last_ts = 0
        self._rusak = False
        self._gagal_berturut = 0
        self._gagal_terakhir = -GAGAL_LOG_JEDA

        if mp is None:
            self.last_error = "mediapipe belum terpasang"
            return
        if cv2 is None:
            self.last_error = "opencv-python belum terpasang"
            return

        if hasattr(mp, "solutions"):
            self._init_solutions()
        elif hasattr(mp, "tasks"):
            self._init_tasks()
        else:
            self.last_error = "mediapipe tidak punya API hands yang dikenal"

    # --- API lama (0.10.x) ------------------------------------------------
    def _init_solutions(self) -> None:
        try:
            self._hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=config.MAX_NUM_HANDS,
                model_complexity=config.MEDIAPIPE_COMPLEXITY,
                min_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
                min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE,
            )
            self.available = True
            self.mode = "solutions"
            log.info("MediaPipe mode solutions (0.10.x)")
        except Exception as exc:  # pragma: no cover
            self.last_error = f"mediapipe solutions gagal dimuat: {exc}"
            log.warning(self.last_error)

    # --- API baru (1.x) ---------------------------------------------------
    def _init_tasks(self) -> None:
        path = config.HAND_MODEL_PATH
        if not path.exists():
            self.last_error = (
                f"berkas {path.name} tidak ada — jalankan "
                "python backend/tools/download_hand_model.py"
            )
            log.warning(self.last_error)
            return
        try:
            from mediapipe.tasks import python as mp_tasks
            from mediapipe.tasks.python import vision

            options = vision.HandLandmarkerOptions(
                base_options=mp_tasks.BaseOptions(model_asset_path=str(path)),
                running_mode=vision.RunningMode.VIDEO,
                num_hands=config.MAX_NUM_HANDS,
                min_hand_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
                min_hand_presence_confidence=config.MIN_DETECTION_CONFIDENCE,
                min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE,
            )
            self._tasks = vision.HandLandmarker.create_from_options(options)
            self.available = True
            self.mode = "tasks"
            log.info("MediaPipe mode tasks (HandLandmarker)")
        except Exception as exc:  # pragma: no cover
            self.last_error = f"HandLandmarker gagal dimuat: {exc}"
            log.warning(self.last_error)

    # --- pemrosesan -------------------------------------------------------
    def process(self, frame):
        """Kembalikan daftar tangan: tiap item 21 landmark (x, y, z) skala 0..1.

        Daftar kosong berarti tidak ada tangan di frame ini.
        """
        if cv2 is None or frame is None:
            return []
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            if self._hands is not None:
                hasil = self._process_solutions(rgb)
            elif self._tasks is not None:
                hasil = self._process_tasks(rgb)
            else:
                return []
        except Exception as exc:  # satu frame jelek tidak boleh mematikan pipeline
            self._lapor_gagal(exc)
            return []
        self._proses_pulih()
        return hasil

    def _lapor_gagal(self, exc) -> None:
        """Catat kegagalan inference tanpa membanjiri log 24 frame per detik."""
        self._rusak = True
        self._gagal_berturut += 1
        self.last_error = f"mediapipe: {exc}"
        if time.monotonic() - self._gagal_terakhir < GAGAL_LOG_JEDA:
            return
        self._gagal_terakhir = time.monotonic()
        log.warning("MediaPipe gagal pada %d frame berturut-turut: %s",
                    self._gagal_berturut, exc)

    def _proses_pulih(self) -> None:
        if not self._rusak:
            return
        log.warning("MediaPipe pulih setelah %d frame gagal", self._gagal_berturut)
        self._rusak = False
        self._gagal_berturut = 0
        self._gagal_terakhir = -GAGAL_LOG_JEDA
        self.last_error = ""

    def _process_solutions(self, rgb):
        result = self._hands.process(rgb)
        if not result.multi_hand_landmarks:
            return []
        return [[(p.x, p.y, p.z) for p in hand.landmark]
                for hand in result.multi_hand_landmarks]

    def _process_tasks(self, rgb):
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        stamp = int(time.monotonic() * 1000)
        if stamp <= self._last_ts:
            stamp = self._last_ts + 1
        self._last_ts = stamp
        result = self._tasks.detect_for_video(image, stamp)
        return [[(p.x, p.y, p.z) for p in hand] for hand in result.hand_landmarks]

    def close(self) -> None:
        for holder in ("_hands", "_tasks"):
            instance = getattr(self, holder)
            if instance is not None:
                try:
                    instance.close()
                except Exception:
                    pass
                setattr(self, holder, None)
        self.available = False
