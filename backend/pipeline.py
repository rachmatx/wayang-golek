"""pipeline.py — satu thread khusus untuk pengolahan gambar.

Alur satu putaran (Rancangan Bab 2.2), sekarang untuk maksimal dua tangan:
  frame -> mirror (camera) -> MediaPipe -> tracker (id tangan)
  -> normalisasi -> model -> smoother per tangan
  -> state.store (dibaca app.py) + stream.frames (dikirim /video_feed)

Satu smoother per id tangan: tanpa itu, gestur tangan kiri bisa nyangkut ke
wayang kanan waktu MediaPipe menukar urutan tangannya.

Thread ini tidak pernah membiarkan satu error mematikan dirinya sendiri.
"""
from __future__ import annotations

import logging
import threading
import time

import config
import stream
from camera import Camera, cek_sinyal
from features import normalize_landmarks
from hand_processor import HandProcessor
from hand_tracker import HandTracker
from model_service import ModelService
from smoother import Smoother
from state import store

log = logging.getLogger(__name__)


class Pipeline(threading.Thread):
    def __init__(self, camera=None, processor=None, models=None) -> None:
        super().__init__(name="wayang-pipeline", daemon=True)
        self._stop_event = threading.Event()
        self.camera = camera or Camera()
        self.processor = processor or HandProcessor()
        self.models = models or ModelService()
        self.tracker = HandTracker(
            max_tangan=config.MAX_NUM_HANDS,
            jarak_maks=config.TRACK_JARAKMAKS,
            hilang_maks=config.TRACK_HILANG_MAKS,
        )
        self.threshold = float(config.CONFIDENCE_THRESHOLD)
        self._smoothers: dict[int, Smoother] = {}
        self._fps = 0.0
        self._read_failures = 0
        self._next_camera_retry = 0.0
        self._last_tick = 0.0
        self._frame_lama = None
        self._sinyal_buruk = 0

    # --- siklus hidup -----------------------------------------------------
    def stop(self) -> None:
        self._stop_event.set()
        self.camera.close()
        self.processor.close()

    # --- ambang & smoother -------------------------------------------------
    def set_threshold(self, value: float) -> float:
        """Ubah ambang kepercayaan untuk semua tangan."""
        probe = Smoother(threshold=value)
        self.threshold = probe.threshold
        for smoother in self._smoothers.values():
            smoother.threshold = self.threshold
        return self.threshold

    def reset_smoothers(self) -> None:
        self._smoothers.clear()

    # --- kendali kamera ----------------------------------------------------
    def _lapor_kamera(self) -> None:
        """Segera kabari health soal kamera; jangan tunggu frame berikutnya."""
        self._next_camera_retry = 0.0
        store.update([], camera=bool(self.camera.available),
                     camera_index=int(self.camera.index),
                     camera_aktif=bool(self.camera.aktif))

    def nyalakan_kamera(self, hidup: bool) -> bool:
        """Hidupkan/matikan kamera atas permintaan user. Balas keadaan akhirnya."""
        self.camera.nyalakan(hidup)
        self._lupakan_sinyal()
        self.tracker.reset()
        self.reset_smoothers()
        self._lapor_kamera()
        return bool(self.camera.available) if hidup else False

    def ganti_kamera(self, index: int) -> bool:
        """Pindah sumber kamera. False bila index itu tidak bisa dipakai."""
        hasil = self.camera.ganti_index(index)
        self._lupakan_sinyal()
        self.tracker.reset()
        self.reset_smoothers()
        self._lapor_kamera()
        return bool(hasil)

    def _smoother_for(self, hand_id: int) -> Smoother:
        smoother = self._smoothers.get(hand_id)
        if smoother is None:
            smoother = Smoother(threshold=self.threshold)
            self._smoothers[hand_id] = smoother
        return smoother

    def _buang_smoother(self) -> None:
        hidup = set(self.tracker.known_ids())
        for hand_id in list(self._smoothers):
            if hand_id not in hidup:
                del self._smoothers[hand_id]

    # --- jalan -------------------------------------------------------------
    def run(self) -> None:
        log.info("pipeline mulai")
        loaded = self.models.load()
        store.set_model(self.models.active, self.models.is_loaded)
        if not loaded:
            log.warning("belum ada model — backend jalan dalam mode tanpa model")

        while not self._stop_event.is_set():
            started = time.perf_counter()
            if self._last_tick:
                delta = started - self._last_tick
                if delta > 0:
                    instant = 1.0 / delta
                    self._fps = instant if self._fps == 0 else (self._fps * 0.85 + instant * 0.15)
            self._last_tick = started

            try:
                self._tick()
            except Exception:  # satu frame jelek tidak boleh mematikan pipeline
                log.exception("pipeline error pada satu putaran")
                time.sleep(config.IDLE_SLEEP)

            spent = time.perf_counter() - started
            remaining = (1.0 / config.TARGET_FPS) - spent
            if remaining > 0:
                self._stop_event.wait(remaining)

        log.info("pipeline berhenti")

    # --- satu putaran -----------------------------------------------------
    def _lupakan_sinyal(self) -> None:
        """Frame terakhir tidak lagi jadi acuan: vonis mulai dari nol."""
        self._frame_lama = None
        self._sinyal_buruk = 0

    def _tick(self) -> None:
        common = {
            "fps": round(self._fps, 1),
            "model": self.models.active,
            "model_loaded": self.models.is_loaded,
            "camera_index": int(getattr(self.camera, "index", 0)),
            "camera_aktif": bool(getattr(self.camera, "aktif", True)),
        }

        # Niat user mengalahkan auto-retry: kamera yang dimatikan lewat tombol
        # harus benar-benar dilepas, bukan dibuka lagi lima detik kemudian.
        if not getattr(self.camera, "aktif", True):
            self._lupakan_sinyal()
            store.update([], camera=False, **common)
            return

        if not self.camera.available:
            now = time.monotonic()
            if now >= self._next_camera_retry:
                self._next_camera_retry = now + config.CAMERA_RETRY_SECONDS
                self.camera.open()
            self._lupakan_sinyal()
            store.update([], camera=self.camera.available, **common)
            return

        frame = self.camera.read()
        if frame is None:
            self._read_failures += 1
            if self._read_failures >= config.MAX_READ_FAILURES:
                log.warning("kamera berhenti mengirim frame — coba buka ulang nanti")
                self.camera.close()
                self._read_failures = 0
                self._lupakan_sinyal()
                self.tracker.reset()
                self.reset_smoothers()
            return
        self._read_failures = 0

        # "Kamera terbuka" belum berarti "gambar bermakna": kamera virtual dan
        # webcam yang macet mengirim frame yang sah secara teknis tapi tidak
        # bisa dibaca MediaPipe. Di bawah batas, tangan tidak dilaporkan; di
        # atasnya, device dilepas supaya health dan inset ikut jujur.
        bagus, alasan = cek_sinyal(frame, self._frame_lama)
        self._frame_lama = frame
        if bagus:
            self._sinyal_buruk = 0
            detected = self.processor.process(frame)
        else:
            self._sinyal_buruk += 1
            if self._sinyal_buruk >= config.SINYAL_BATAS_FRAME:
                log.warning("kamera tidak mengirim gambar bermakna: %s", alasan)
                self.camera.last_error = alasan
                self.camera.close()
                self._lupakan_sinyal()
                self.tracker.reset()
                self.reset_smoothers()
                store.update([], camera=False, **common)
                return
            store.update([], camera=True, **common)
            return

        stream.frames.push_frame(frame)

        ids = self.tracker.update([(hand[0][0], hand[0][1]) for hand in detected])
        self._buang_smoother()

        hands = [
            self._olah_tangan(hand_id, landmarks, frame)
            for hand_id, landmarks in zip(ids, detected)
        ]
        store.update(hands, camera=True, **common)

    def _olah_tangan(self, hand_id: int, landmarks, frame) -> dict:
        """Satu tangan -> hasil smoother. State 'unknown' kalau belum yakin."""
        hasil = {
            "id": hand_id,
            "gesture": None,
            "confidence": 0.0,
            "wrist_x": round(float(landmarks[0][0]), 4),
            "wrist_y": round(float(landmarks[0][1]), 4),
            "state": "unknown",
            "top3": [],
            "landmarks": [
                [round(float(p[0]), 4), round(float(p[1]), 4)] for p in landmarks
            ],
        }

        try:
            features = normalize_landmarks(
                landmarks,
                image_size=(frame.shape[1], frame.shape[0]),
            )
        except ValueError as exc:
            log.debug("landmark tidak valid: %s", exc)
            return hasil

        prediction = self.models.predict(features)
        if prediction is None:
            return hasil

        result = self._smoother_for(hand_id).update(
            prediction["label"], prediction["confidence"]
        )
        hasil["state"] = result["state"]
        hasil["gesture"] = result["gesture"]
        hasil["confidence"] = round(float(result["confidence"]), 4)
        hasil["top3"] = prediction["top3"]
        return hasil
