"""cameras.py — daftar sumber kamera yang bisa dipilih user.

OpenCV tidak memberi nama device di Windows: yang bisa dibaca cuma index dan
resolusi, jadi labelnya "Kamera 1 — 640x480" dan identitasnya diketahui orang
dengan cara mengganti lalu melihat inset panggung.

Pemindaian mahal (0,4-2,5 detik per index di mesin Windows) dan device yang
sedang dipegang pipeline tidak akan pernah lolos probe — kamera bersifat
exclusive. Karena itu index aktif dilewati dan ditandai dari luar, dan hasil
pemindaian disimpan di cache sampai ada yang minta penyegaran.

`cv` sengaja diterima sebagai parameter: tanpa webcam pun logika pemindaian,
penghentian dini, dan pelabelannya bisa diuji (lihat tools/test_kamera.py).
"""
from __future__ import annotations

import threading
import time

import config

_lock = threading.Lock()
_cache: dict = {"isi": None, "pada": 0.0}


def _label(infos: dict) -> str:
    dasar = (f"Kamera {infos['index']} — {infos['lebar']}×{infos['tinggi']}"
             if infos["tersedia"] else f"Kamera {infos['index']} — tidak terbaca")
    return dasar + " (aktif)" if infos["aktif"] else dasar


def _item(index: int, tersedia: bool, lebar: int, tinggi: int, alasan: str,
          aktif: bool = False) -> dict:
    item = {
        "index": int(index),
        "tersedia": bool(tersedia),
        "aktif": bool(aktif),
        "lebar": int(lebar),
        "tinggi": int(tinggi),
        "alasan": alasan,
    }
    item["label"] = _label(item)
    return item


def _probe(cv, index: int) -> dict:
    """Buka-baca-lepas satu index. Tidak melempar apa pun ke pemanggil."""
    try:
        cap = cv.VideoCapture(index)
    except Exception as exc:  # pragma: no cover - driver bisa melempar apa saja
        return _item(index, False, 0, 0, f"gagal membuka: {exc}")
    try:
        if not cap.isOpened():
            return _item(index, False, 0, 0, "tidak terbuka")
        ok, _frame = cap.read()
        if not ok:
            return _item(index, False, 0, 0, "terbuka tapi tidak mengirim frame")
        lebar = int(cap.get(cv.CAP_PROP_FRAME_WIDTH) or 0)
        tinggi = int(cap.get(cv.CAP_PROP_FRAME_HEIGHT) or 0)
        return _item(index, True, lebar, tinggi, "")
    except Exception as exc:  # pragma: no cover
        return _item(index, False, 0, 0, f"gagal membaca: {exc}")
    finally:
        try:
            cap.release()
        except Exception:
            pass


def daftar_kamera(cv, aktif: dict | None = None,
                  jumlah_maks: int = config.CAMERA_SCAN_MAKS,
                  henti_setelah_gagal: int = config.CAMERA_SCAN_HENTI_GAGAL) -> list[dict]:
    """Daftar index yang layak ditampilkan, berurutan, dengan label siap pakai."""
    if cv is None:
        return []

    indeks_aktif = int(aktif["index"]) if aktif and aktif.get("index") is not None else None
    hasil: list[dict] = []
    if indeks_aktif is not None:
        hasil.append(_item(indeks_aktif, True,
                           int(aktif.get("lebar") or 0), int(aktif.get("tinggi") or 0),
                           "", aktif=True))

    kosong_beruntun = 0
    for index in range(max(0, int(jumlah_maks))):
        if index == indeks_aktif:
            continue
        item = _probe(cv, index)
        hasil.append(item)
        if item["tersedia"]:
            kosong_beruntun = 0
            continue
        kosong_beruntun += 1
        if kosong_beruntun >= max(1, int(henti_setelah_gagal)):
            break
    return hasil


def ambil(cv, aktif: dict | None = None, paksa: bool = False, **opsi) -> list[dict]:
    """Hasil pemindaian terakhir; hanya memindai ulang kalau diminta."""
    with _lock:
        if not paksa and _cache["isi"] is not None:
            return [_tandai(item, aktif) for item in _cache["isi"]]
        isi = daftar_kamera(cv, aktif=aktif, **opsi)
        _cache["isi"] = isi
        _cache["pada"] = time.time()
        return isi


def _tandai(item: dict, aktif: dict | None) -> dict:
    salinan = dict(item)
    indeks_aktif = int(aktif["index"]) if aktif and aktif.get("index") is not None else None
    jadi_aktif = indeks_aktif is not None and salinan["index"] == indeks_aktif
    if jadi_aktif and not salinan["aktif"]:
        salinan["aktif"] = True
        salinan["lebar"] = int(aktif.get("lebar") or salinan["lebar"])
        salinan["tinggi"] = int(aktif.get("tinggi") or salinan["tinggi"])
        salinan["tersedia"] = True
        salinan["alasan"] = ""
        salinan["label"] = _label(salinan)
    return salinan


def lupakan() -> None:
    with _lock:
        _cache["isi"] = None
        _cache["pada"] = 0.0
