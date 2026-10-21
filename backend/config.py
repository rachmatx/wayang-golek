"""config.py — semua angka setelan di satu tempat (Rancangan Bab 2.4).

Ubah angka di sini, bukan di file lain. Bila sebuah setelan diubah saat
pengujian, catat perubahannya untuk laporan.
"""
from __future__ import annotations

import os
from pathlib import Path

# --- Lokasi ---------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
SHARED_DIR = BASE_DIR / "shared"
MODEL_DIR = Path(os.environ.get("WAYANG_MODEL_DIR", str(BASE_DIR / "models")))
GESTURE_MAP_PATH = SHARED_DIR / "gesture_map.json"

# --- Server ---------------------------------------------------------------
HOST = os.environ.get("WAYANG_HOST", "127.0.0.1")
PORT = int(os.environ.get("WAYANG_PORT", "8000"))

# --- Kamera ---------------------------------------------------------------
CAMERA_INDEX = int(os.environ.get("WAYANG_CAMERA", "0"))
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
MIRROR = True
CAMERA_RETRY_SECONDS = 5.0
MAX_READ_FAILURES = 10

# --- MediaPipe ------------------------------------------------------------
MEDIAPIPE_COMPLEXITY = 0
MIN_DETECTION_CONFIDENCE = 0.5
MIN_TRACKING_CONFIDENCE = 0.5
MAX_NUM_HANDS = 2
# Tracker: tangan dianggap sama kalau wrist-nya bergerak tidak lebih jauh dari
# TRACK_JARAKMAKS (skala gambar 0..1), dan track dibuang setelah
# TRACK_HILANG_MAKS frame tanpa pasangan.
TRACK_JARAKMAKS = 0.12
TRACK_HILANG_MAKS = 5
# MediaPipe 1.x memakai API tasks dan butuh berkas model ini (sudah disertakan).
HAND_MODEL_PATH = Path(
    os.environ.get("WAYANG_HAND_MODEL",
                   str(BASE_DIR / "backend" / "assets" / "hand_landmarker.task"))
)
HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

# --- Fitur (HARUS SAMA PERSIS DENGAN P2) ----------------------------------
# 21 landmark x (x, y, z) = 63 angka. features.py menyalin normalization.py
# P2 dan selalu memakai use_z=False (model dilatih dari landmark 2D HaGRID).
# Konstanta ini hanya dokumentasi; jangan diubah tanpa melatih ulang model.
FEATURE_USE_Z = False
FEATURE_COUNT = 63

# --- Model ----------------------------------------------------------------
DEFAULT_MODEL = "mlp"
MODEL_FILES = {
    "mlp": "model_mlp.pkl",
    "rf": "model_rf.pkl",
}
LABELS_PATH = MODEL_DIR / "labels.json"

# --- Smoother -------------------------------------------------------------
CONFIDENCE_THRESHOLD = 0.60
SMOOTHING_WINDOW = 5
MIN_HOLD_FRAMES = 3

# --- WebSocket ------------------------------------------------------------
WS_SEND_INTERVAL = 0.05
WS_HEARTBEAT_INTERVAL = 0.25

# --- Pipeline -------------------------------------------------------------
TARGET_FPS = 24
IDLE_SLEEP = 0.20
JPEG_QUALITY = 70
