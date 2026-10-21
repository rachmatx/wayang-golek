"""Skrip cek WebSocket — dipakai untuk uji 'backend saja' (Rancangan Bab 5).

Jalankan sementara backend hidup:
    python backend/tools/ws_check.py
    python backend/tools/ws_check.py ws://127.0.0.1:8000/ws/predict
"""
from __future__ import annotations

import asyncio
import json
import sys

import websockets


async def main(url: str) -> None:
    print(f"menyambung ke {url} ...")
    async with websockets.connect(url) as ws:
        print("tersambung. 5 pesan pertama:")
        for index in range(5):
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            print(f"  {index + 1}. {json.dumps(json.loads(raw), ensure_ascii=False)}")
        await ws.send(json.dumps({"command": "ping"}))
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            message = json.loads(raw)
            if message.get("type") != "prediction":
                print("balasan ping:", json.dumps(message, ensure_ascii=False))
                break
    print("selesai.")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "ws://127.0.0.1:8000/ws/predict"
    asyncio.run(main(target))
