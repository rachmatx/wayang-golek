"""diag_baring.py — bukti serentak: frame kamera vs isi WebSocket.

Satu proses membaca /video_feed dan mendeteksi tangan sendiri (MediaPipe lokal),
satu thread lain merekam apa yang dikirim server lewat /ws/predict pada detik
yang sama. Jadi tidak bisa lagi dibohongi soal "tangannya lagi nggak ada".

    python backend/tools/diag_baring.py
    python backend/tools/diag_baring.py --tahan 12 --lama 20
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import config  # noqa: E402
from hand_processor import HandProcessor  # noqa: E402

import websockets  # noqa: E402
import asyncio  # noqa: E402


def pemantau_ws(url: str, berhenti: threading.Event, rekaman: deque) -> None:
    async def jalan():
        async with websockets.connect(url) as ws:
            while not berhenti.is_set():
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                except Exception as exc:
                    rekaman.append((time.time(), "WS-MATI", str(exc)))
                    return
                pesan = json.loads(raw)
                tangan = pesan.get("hands")
                rekaman.append((time.time(), "WS", len(tangan) if isinstance(tangan, list) else "TANPA_KEY"))
    asyncio.run(jalan())


def pembaca_frame(url: str, processor: HandProcessor, berhenti: threading.Event,
                  rekaman: deque) -> None:
    buffer = b""
    with urllib.request.urlopen(url, timeout=30) as response:
        while not berhenti.is_set():
            chunk = response.read(65536)
            if not chunk:
                break
            buffer += chunk
            while True:
                mulai = buffer.find(b"\xff\xd8")
                akhir = buffer.find(b"\xff\xd9")
                if mulai == -1 or akhir == -1 or akhir <= mulai:
                    break
                jpeg = buffer[mulai:akhir + 2]
                buffer = buffer[akhir + 2:]
                image = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
                if image is None:
                    continue
                jumlah = len(processor.process(image))
                rekaman.append((time.time(), "KAMERA", jumlah))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1:8000")
    parser.add_argument("--tahan", type=float, default=10.0)
    parser.add_argument("--lama", type=float, default=20.0)
    args = parser.parse_args()

    processor = HandProcessor()
    print(f"MediaPipe lokal: available={processor.available} mode={processor.mode}")
    if not processor.available:
        return 2

    print(f"menunggu {args.tahan:.0f}s — angkat tangan dan TAHAN terus...")
    time.sleep(args.tahan)

    berhenti = threading.Event()
    rekaman: deque = deque(maxlen=4000)
    thread_ws = threading.Thread(target=pemantau_ws, daemon=True,
                                 args=(f"ws://{args.host}/ws/predict", berhenti, rekaman))
    thread_kamera = threading.Thread(target=pembaca_frame, daemon=True,
                                     args=(f"http://{args.host}/video_feed", processor, berhenti, rekaman))
    thread_ws.start()
    thread_kamera.start()
    time.sleep(args.lama)
    berhenti.set()
    time.sleep(0.5)
    processor.close()

    daftar = list(rekaman)
    kamera = [r for r in daftar if r[1] == "KAMERA"]
    ws = [r for r in daftar if r[1] == "WS"]
    tangan_liat = [r for r in kamera if r[2] > 0]
    ws_terisi = [r for r in ws if r[2] != 0]

    print(f"\nframe kamera   : {len(kamera)}, yang ada tangan  : {len(tangan_liat)}")
    print(f"pesan WS       : {len(ws)}, yang hands terisi : {len(ws_terisi)}")

    if not tangan_liat:
        print("\n=> MediaPipe LOKAL juga tidak melihat tangan: kamera/posisi yang jadi soal, bukan kodenya.")
        return 0

    # Untuk tiap frame yang jelas ada tangannya, cari pesan WS terdekat.
    contoh = 0
    for waktu, _label, jumlah in tangan_liat:
        tetangga = [r for r in ws if abs(r[0] - waktu) < 0.15]
        if not tetangga:
            continue
        contoh += 1
        if contoh <= 5:
            isi = ", ".join(str(r[2]) for r in tetangga[:4])
            print(f"  detik {waktu:.2f}: kamera lihat {jumlah} tangan -> WS kirim hands=[{isi}]")
    print(f"\n{contoh} frame bertangan dicocokkan dengan pesan WS.")
    if not ws_terisi:
        print("=> BUKTI: server MELIHAT tangan di frame yang sama, tapi WebSocket mengirim hands=[].")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
