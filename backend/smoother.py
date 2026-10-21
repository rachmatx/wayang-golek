"""smoother.py — majority vote 5 frame + ambang 0,60 + aturan tahan 3 frame."""
from __future__ import annotations

from collections import Counter, deque

import config


class Smoother:
    def __init__(self, window: int = config.SMOOTHING_WINDOW,
                 threshold: float = config.CONFIDENCE_THRESHOLD,
                 min_hold: int = config.MIN_HOLD_FRAMES) -> None:
        self.window = max(1, int(window))
        self.threshold = float(threshold)
        self.min_hold = max(1, int(min_hold))
        self._votes: deque[tuple[str | None, float]] = deque(maxlen=self.window)
        self._candidate: str | None = None
        self._streak = 0
        self._final: str | None = None

    def reset(self) -> None:
        self._votes.clear()
        self._candidate = None
        self._streak = 0
        self._final = None

    def set_threshold(self, value: float) -> float:
        self.threshold = max(0.05, min(0.99, float(value)))
        return self.threshold

    def update(self, label: str | None, confidence: float) -> dict:
        """Satu frame masuk. Hasil: {state, gesture, confidence}."""
        confidence = float(confidence)
        vote = label if (label is not None and confidence >= self.threshold) else None
        self._votes.append((vote, confidence))

        majority = self._majority()
        if majority is None:
            self._candidate = None
            self._streak = 0
            self._final = None
            return {"state": "unknown", "gesture": None, "confidence": confidence}

        if majority == self._candidate:
            self._streak += 1
        else:
            # Label baru wajib muncul MIN_HOLD_FRAMES berturut-turut.
            self._candidate = majority
            self._streak = 1
            self._final = None

        if self._streak >= self.min_hold:
            self._final = majority
            return {
                "state": "ok",
                "gesture": majority,
                "confidence": self._average_confidence(majority),
            }

        if self._final is not None:
            return {
                "state": "ok",
                "gesture": self._final,
                "confidence": self._average_confidence(self._final),
            }
        return {"state": "unknown", "gesture": None, "confidence": confidence}

    def _majority(self) -> str | None:
        """Suara terbanyak dari frame yang yakin; frame ragu tidak ikut memilih."""
        labels = [vote for vote, _ in self._votes if vote is not None]
        if not labels:
            return None
        counts = Counter(labels)
        best = max(counts.values())
        leaders = [label for label, count in counts.items() if count == best]
        if len(leaders) != 1:
            return None  # seri -> jangan menebak
        return leaders[0]

    def _average_confidence(self, label: str) -> float:
        scores = [conf for vote, conf in self._votes if vote == label]
        if not scores:
            return 0.0
        return sum(scores) / len(scores)
