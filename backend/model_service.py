"""model_service.py — muat model.pkl + labels.json dari P2, tebak gestur.

Mendukung dua model sekaligus (MLP & RF). Bila file belum ada, service tetap
hidup: `predict()` mengembalikan None dan pipeline mengirim state = unknown.
"""
from __future__ import annotations

import json
import logging
import threading

import config

try:  # pragma: no cover
    import joblib
except Exception:  # pragma: no cover
    joblib = None

try:  # pragma: no cover
    import numpy as np
except Exception:  # pragma: no cover
    np = None

log = logging.getLogger(__name__)


def _load_labels() -> list[str]:
    path = config.LABELS_PATH
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("labels.json tidak terbaca: %s", exc)
        return []
    if isinstance(raw, list):
        return [str(item) for item in raw]
    if isinstance(raw, dict):
        for key in ("labels", "classes", "names"):
            value = raw.get(key)
            if isinstance(value, list):
                return [str(item) for item in value]
        # bentuk {"0": "telapak_terbuka", "1": ...}
        if all(str(k).isdigit() for k in raw.keys()):
            return [str(raw[k]) for k in sorted(raw, key=lambda x: int(x))]
    return []


class ModelService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, dict] = {}
        self._labels: list[str] = []
        self.active = config.DEFAULT_MODEL
        self.last_error = ""

    # --- pemuatan ---------------------------------------------------------
    def load(self) -> list[str]:
        """Muat semua model yang filenya ada. Kembalikan nama yang berhasil."""
        self._labels = _load_labels()
        loaded: list[str] = []
        if joblib is None or np is None:
            self.last_error = "joblib/numpy belum terpasang"
            return loaded

        for name, filename in config.MODEL_FILES.items():
            path = config.MODEL_DIR / filename
            if not path.exists():
                log.info("model %s belum ada di %s", name, path)
                continue
            try:
                entry = self._load_one(path)
                with self._lock:
                    self._entries[name] = entry
                loaded.append(name)
                log.info("model %s dimuat dari %s", name, path.name)
            except Exception as exc:
                self.last_error = f"{name}: {exc}"
                log.warning("model %s gagal dimuat: %s", name, exc)
        return loaded

    def _load_one(self, path) -> dict:
        bundle = joblib.load(path)
        model = bundle
        scaler = None
        labels = None
        if isinstance(bundle, dict):
            model = bundle.get("model") or bundle.get("estimator") or bundle.get("clf")
            scaler = bundle.get("scaler")
            labels = bundle.get("labels") or bundle.get("classes")
            if model is None:
                raise ValueError("dict model tidak punya kunci 'model'")
        return {"model": model, "scaler": scaler, "labels": labels}

    # --- status -----------------------------------------------------------
    @property
    def is_loaded(self) -> bool:
        with self._lock:
            return bool(self._entries)

    def loaded_names(self) -> list[str]:
        with self._lock:
            return sorted(self._entries.keys())

    def set_active(self, name: str) -> bool:
        name = (name or "").lower()
        with self._lock:
            if name not in self._entries:
                return False
            self.active = name
        log.info("model aktif: %s", name)
        return True

    # --- prediksi ---------------------------------------------------------
    def predict(self, features: list[float]) -> dict | None:
        with self._lock:
            entry = self._entries.get(self.active)
            labels = self._labels
        if entry is None or not features:
            return None
        if np is None:
            return None

        try:
            x = np.asarray(features, dtype=float).reshape(1, -1)
            scaler = entry["scaler"]
            if scaler is not None:
                x = scaler.transform(x)
            model = entry["model"]

            if hasattr(model, "predict_proba"):
                proba = np.asarray(model.predict_proba(x))[0]
                classes = list(getattr(model, "classes_", range(len(proba))))
                order = np.argsort(proba)[::-1][:3]
                top3 = [[self._label(classes[i], entry, labels), round(float(proba[i]), 4)]
                        for i in order]
                best_label, best_score = top3[0]
                return {"label": best_label, "confidence": float(best_score), "top3": top3}

            prediction = model.predict(x)[0]
            label = self._label(prediction, entry, labels)
            return {"label": label, "confidence": 1.0, "top3": [[label, 1.0]]}
        except Exception as exc:
            self.last_error = str(exc)
            log.debug("prediksi gagal: %s", exc)
            return None

    @staticmethod
    def _label(value, entry: dict, global_labels: list[str]) -> str:
        own_labels = entry.get("labels")
        if isinstance(value, str):
            return value
        try:
            index = int(value)
        except (TypeError, ValueError):
            return str(value)
        for source in (own_labels, global_labels):
            if isinstance(source, list) and 0 <= index < len(source):
                return str(source[index])
        return f"kelas_{index}"
