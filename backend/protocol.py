"""protocol.py — bentuk pesan WebSocket /ws/predict (kontrak gestur SDD Bab 5).

Dua tangan: satu pesan memuat daftar `hands`. Tiap item punya field kontrak
SDD (gesture, confidence, wrist_x, wrist_y, state) ditambah `id` supaya
frontend bisa mengikat satu tangan ke satu wayang. Panggung tanpa tangan
mengirim `hands: []`.

Letak pesan di sini, bukan di app.py, supaya bentuk kontraknya bisa diuji
tanpa menarik FastAPI, MediaPipe, dan kamera.
"""
from __future__ import annotations


def hand_message(hand: dict) -> dict:
    return {
        "id": int(hand["id"]),
        "gesture": hand["gesture"],
        "confidence": round(float(hand["confidence"]), 4),
        "wrist_x": round(float(hand["wrist_x"]), 4),
        "wrist_y": round(float(hand["wrist_y"]), 4),
        "state": hand["state"],
        "top3": hand.get("top3", []),
        "landmarks": hand.get("landmarks"),
    }


def prediction_message(snapshot: dict) -> dict:
    return {
        "type": "prediction",
        "hands": [hand_message(hand) for hand in (snapshot.get("hands") or [])],
        "fps": snapshot["fps"],
        "model": snapshot["model"],
        "model_loaded": snapshot["model_loaded"],
        "camera": snapshot["camera"],
    }
