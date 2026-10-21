"""Uji logika murni (tanpa kamera, tanpa model) — Rancangan Bab 5.

Jalankan:  python backend/tools/test_logika.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from features import normalize_landmarks  # noqa: E402
from smoother import Smoother  # noqa: E402

GAGAL = 0


def cek(nama: str, kondisi: bool) -> None:
    global GAGAL
    tanda = "OK  " if kondisi else "GAGAL"
    print(f"[{tanda}] {nama}")
    if not kondisi:
        GAGAL += 1


def uji_features() -> None:
    # Tangan sintetis ala MediaPipe: koordinat 0..1, frame 640x480.
    # wrist di (0.5, 0.5), titik 9 tepat 0.1 (64 px) di kanannya.
    landmarks = [(0.5, 0.5, 0.0)] + [(0.5 + i * 0.01, 0.5 + i * 0.01, 0.0) for i in range(1, 21)]
    landmarks[9] = (0.6, 0.5, 0.0)

    numbers = normalize_landmarks(landmarks, image_size=(640, 480))
    cek(f"panjang fitur = {len(numbers)}", len(numbers) == config.FEATURE_COUNT)
    cek("wrist menjadi (0, 0)", abs(numbers[0]) < 1e-9 and abs(numbers[1]) < 1e-9)
    cek("landmark 9 berjarak 1 dari wrist",
        abs(numbers[27] - 1.0) < 1e-9 and abs(numbers[28]) < 1e-9)
    cek("z selalu 0 (model dilatih 2D)", all(abs(numbers[i]) < 1e-9 for i in range(2, 63, 3)))

    # Koreksi aspect ratio: offset 0.1 di x (64 px) dan 0.1 di y (48 px)
    # harus jadi 1.0 dan 0.75, bukan 1.0 dan 1.0.
    uji = [(0.5, 0.5, 0.0)] * 21
    uji[9] = (0.6, 0.5, 0.0)
    uji[1] = (0.6, 0.6, 0.0)
    angka = normalize_landmarks(uji, image_size=(640, 480))
    cek("bentuk tangan tidak gepeng (koreksi aspect ratio)",
        abs(angka[3] - 1.0) < 1e-9 and abs(angka[4] - 0.75) < 1e-9)

    try:
        normalize_landmarks([])
        kosong_ditolak = False
    except ValueError:
        kosong_ditolak = True
    cek("landmark kosong ditolak (sama dengan P2)", kosong_ditolak)


def uji_smoother() -> None:
    smoother = Smoother(window=5, threshold=0.60, min_hold=3)

    hasil = [smoother.update("dua_jari", 0.9) for _ in range(2)]
    cek("2 frame belum cukup -> unknown", all(item["state"] == "unknown" for item in hasil))

    hasil = smoother.update("dua_jari", 0.9)
    cek("frame ke-3 -> ok / dua_jari",
        hasil["state"] == "ok" and hasil["gesture"] == "dua_jari")

    # Satu frame ngawur tidak boleh mengganti label (majority vote).
    hasil = smoother.update("ok", 0.9)
    cek("satu frame menyimpang tetap dua_jari", hasil["gesture"] == "dua_jari")

    # Confidence rendah -> dianggap tidak ada suara.
    for _ in range(5):
        hasil = smoother.update("dua_jari", 0.20)
    cek("confidence < ambang -> unknown", hasil["state"] == "unknown" and hasil["gesture"] is None)

    # Label baru harus bertahan 3 frame.
    hasil = [smoother.update("telapak_terbuka", 0.95) for _ in range(3)]
    cek("label baru butuh 3 frame",
        hasil[0]["gesture"] is None and hasil[1]["gesture"] is None
        and hasil[2]["gesture"] == "telapak_terbuka")


def uji_hand_tracker() -> None:
    from hand_tracker import HandTracker

    tracker = HandTracker(max_tangan=2, jarak_maks=0.12, hilang_maks=5)

    satu = tracker.update([(0.20, 0.50)])
    geser = tracker.update([(0.21, 0.50)])
    cek("tangan yang bergeser sedikit tetap id yang sama", satu[0] == geser[0])

    dua = tracker.update([(0.20, 0.50), (0.80, 0.50)])
    cek("dua tangan dapat dua id berbeda", len(set(dua)) == 2)
    cek("id tangan kiri tidak berubah saat tangan kanan datang", dua[0] == satu[0])

    for _ in range(6):
        tracker.update([])
    datang_lagi = tracker.update([(0.20, 0.50)])
    cek("track dibuang setelah 6 frame kosong", datang_lagi[0] != satu[0])

    senyap = HandTracker(max_tangan=1, jarak_maks=0.12, hilang_maks=5)
    awal = senyap.update([(0.20, 0.50)])
    lompat = senyap.update([(0.90, 0.50)])
    cek("lompat melebihi jarak_maks dianggap tangan baru", awal[0] != lompat[0])

    cek("tidak ada tangan -> daftar id kosong", senyap.update([]) == [])


def uji_prediction_message() -> None:
    from protocol import prediction_message

    snapshot = {
        "hands": [
            {"id": 0, "gesture": "ok", "confidence": 0.91234,
             "wrist_x": 0.2, "wrist_y": 0.55, "state": "ok"},
            {"id": 1, "gesture": None, "confidence": 0.4,
             "wrist_x": 0.8, "wrist_y": 0.5, "state": "unknown"},
        ],
        "fps": 23.4, "model": "mlp", "model_loaded": True, "camera": True,
    }
    pesan = prediction_message(snapshot)
    cek("tipe pesan prediction", pesan["type"] == "prediction")
    cek("satu item hands per tangan", len(pesan["hands"]) == 2)
    cek("confidence dibulatkan 4 desimal", pesan["hands"][0]["confidence"] == 0.9123)
    cek("id tangan ikut dikirim", [h["id"] for h in pesan["hands"]] == [0, 1])
    cek("field tunggal lama dihapus",
        not ({"gesture", "confidence", "wrist_x", "wrist_y", "state"} & set(pesan)))
    cek("fps, model dan kamera tetap di atas",
        pesan["fps"] == 23.4 and pesan["model"] == "mlp" and pesan["camera"] is True)

    kosong = prediction_message({"hands": [], "fps": 0.0, "model": "mlp",
                               "model_loaded": False, "camera": False})
    cek("panggung tanpa tangan -> hands []", kosong["hands"] == [])


def uji_gesture_map() -> None:
    path = ROOT / "shared" / "gesture_map.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    ids = [item["id"] for item in data["gestures"]]
    cek("gesture_map berisi 6 gestur", len(ids) == 6)
    wajib = ["telapak_terbuka", "kepalan", "telunjuk", "dua_jari", "jempol", "ok"]
    cek("id gestur sesuai SDD", ids == wajib)

    js = (ROOT / "frontend" / "js" / "animation.js").read_text(encoding="utf-8")
    for gestur in data["gestures"]:
        cek(f"pose '{gestur['pose']}' ada di animation.js", f"{gestur['pose']}: {{" in js)


if __name__ == "__main__":
    uji_features()
    uji_smoother()
    uji_hand_tracker()
    uji_prediction_message()
    uji_gesture_map()
    print()
    if GAGAL:
        print(f"{GAGAL} pemeriksaan GAGAL")
        raise SystemExit(1)
    print("semua pemeriksaan lolos")
