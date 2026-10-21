"""
Modul inferensi gestur — dipakai backend P1 dan demo webcam.

Kontrak keluaran (Bab 4 SDD):
    {"gesture": "ok", "confidence": 0.92,
     "wrist_x": 0.51, "wrist_y": 0.62, "state": "ok"}

Contoh:
    from inference import GesturePredictor

    predictor = GesturePredictor()                 # load model.pkl
    hasil = predictor.predict(
        [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark],
        image_size=(frame_w, frame_h),
    )
    # hasil["gesture"], hasil["confidence"], ...
"""
import os
import json

import joblib
import numpy as np

from normalization import normalize_landmarks

BASE = os.path.dirname(os.path.abspath(__file__))


def _first_existing(*paths):
    for p in paths:
        if os.path.exists(p):
            return p
    return paths[0]


# mendukung dua layout: file di root paket (handoff) atau di models/ (proyek)
MODEL_PATH = _first_existing(os.path.join(BASE, "model.pkl"),
                             os.path.join(BASE, "models", "model.pkl"))
LABELS_PATH = _first_existing(os.path.join(BASE, "labels.json"),
                              os.path.join(BASE, "models", "labels.json"))


class GesturePredictor:
    def __init__(self, model_path=MODEL_PATH, labels_path=LABELS_PATH):
        self.model = joblib.load(model_path)
        with open(labels_path, encoding="utf-8") as f:
            meta = json.load(f)
        self.labels = meta["labels"]
        self.n_features = meta.get("n_features", 63)

    def predict(self, landmarks, image_size=None):
        """Prediksi satu tangan.

        landmarks : 21 titik (x,y) atau (x,y,z). Normalized 0..1 bila
                    `image_size` diisi, atau piksel bila None.
        Returns   : dict gesture, confidence, probabilitas semua kelas.
        """
        feats = normalize_landmarks(landmarks, image_size=image_size)
        proba = self.model.predict_proba(np.asarray(feats).reshape(1, -1))[0]
        idx = int(np.argmax(proba))
        return {
            "gesture": self.labels[idx],
            "confidence": round(float(proba[idx]), 4),
            "probabilities": {lab: round(float(p), 4)
                              for lab, p in zip(self.labels, proba)},
        }

    def predict_json(self, landmarks, image_size=None, state="ok"):
        """Seperti predict(), tapi langsung berbentuk JSON kontrak P1."""
        out = self.predict(landmarks, image_size=image_size)
        wrist = landmarks[0]
        return {
            "gesture": out["gesture"],
            "confidence": out["confidence"],
            "wrist_x": round(float(wrist[0]), 4),
            "wrist_y": round(float(wrist[1]), 4),
            "state": state,
        }
