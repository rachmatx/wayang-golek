"""app.py — FastAPI: semua endpoint + WebSocket. File utama, isinya tipis.

Logika ada di modul lain; file ini hanya merakit (Rancangan Bab 2.1).
Jalankan dari akar proyek:  python -m backend.app
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

import config  # noqa: E402
import pipeline as pipeline_mod  # noqa: E402
import protocol  # noqa: E402
import state as state_mod  # noqa: E402
import stream as stream_mod  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)-16s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wayang")

_pipeline: pipeline_mod.Pipeline | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _pipeline
    _pipeline = pipeline_mod.Pipeline()
    _pipeline.start()
    log.info("server siap di http://%s:%s", config.HOST, config.PORT)
    try:
        yield
    finally:
        if _pipeline is not None:
            _pipeline.stop()


app = FastAPI(
    title="Wayang Digital Gestur Tangan",
    version="0.1",
    lifespan=lifespan,
)

# Membantu bila frontend dibuka lewat Live Server / file:// saat mengembangkan.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Halaman & berkas statis ---------------------------------------------
@app.get("/")
async def index():
    return FileResponse(config.FRONTEND_DIR / "index.html")


for _folder in ("css", "js", "assets"):
    _path = config.FRONTEND_DIR / _folder
    if _path.exists():
        app.mount(f"/{_folder}", StaticFiles(directory=_path), name=_folder)


# --- API ------------------------------------------------------------------
@app.get("/api/health")
async def health():
    data = state_mod.store.health()
    data["camera_backend"] = _pipeline.camera.last_error if _pipeline else ""
    data["components"] = {
        "opencv": bool(_pipeline and _pipeline.camera.cv_available),
        "mediapipe": bool(_pipeline and _pipeline.processor.available),
        "mediapipe_mode": _pipeline.processor.mode if _pipeline else "none",
        "mediapipe_error": _pipeline.processor.last_error if _pipeline else "",
        "models": _pipeline.models.loaded_names() if _pipeline else [],
        "threshold": _pipeline.threshold if _pipeline else config.CONFIDENCE_THRESHOLD,
    }
    return data


@app.get("/api/gesture-map")
async def gesture_map():
    path = config.GESTURE_MAP_PATH
    if not path.exists():
        return JSONResponse({"error": "gesture_map.json belum ada"}, status_code=404)
    try:
        return JSONResponse(json.loads(path.read_text(encoding="utf-8")))
    except Exception as exc:
        return JSONResponse({"error": f"gesture_map.json tidak terbaca: {exc}"},
                            status_code=500)


@app.get("/video_feed")
async def video_feed():
    if not state_mod.store.health()["camera"]:
        # Bukan MJPEG, tapi browser tetap bisa menampilkannya di <img>.
        return FileResponse(
            config.FRONTEND_DIR / "assets" / "kamera-off.svg",
            media_type="image/svg+xml",
            headers={"Cache-Control": "no-store"},
        )
    return StreamingResponse(
        stream_mod.mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


# --- WebSocket ------------------------------------------------------------
async def _send(ws: WebSocket, lock: asyncio.Lock, payload: dict) -> None:
    async with lock:
        await ws.send_json(payload)


async def handle_command(raw: str, ws: WebSocket, lock: asyncio.Lock) -> None:
    try:
        message = json.loads(raw)
    except (TypeError, ValueError):
        return
    command = message.get("command")

    if command == "ping":
        await _send(ws, lock, {"type": "pong", "ts": time.time()})
        return

    if command == "set_model":
        name = str(message.get("model", "")).lower()
        ok = bool(_pipeline and _pipeline.models.set_active(name))
        if ok:
            state_mod.store.set_model(_pipeline.models.active, _pipeline.models.is_loaded)
            _pipeline.reset_smoothers()
        await _send(ws, lock, {"type": "ack", "command": "set_model",
                               "model": name, "ok": ok})
        return

    if command == "set_threshold":
        try:
            value = float(message.get("value"))
        except (TypeError, ValueError):
            return
        value = _pipeline.set_threshold(value) if _pipeline else value
        await _send(ws, lock, {"type": "ack", "command": "set_threshold",
                               "value": value})
        return


@app.websocket("/ws/predict")
async def ws_predict(ws: WebSocket):
    await ws.accept()
    send_lock = asyncio.Lock()
    closed = asyncio.Event()

    async def read_loop():
        try:
            while True:
                raw = await ws.receive_text()
                await handle_command(raw, ws, send_lock)
        except WebSocketDisconnect:
            pass
        except Exception:
            log.debug("pembacaan perintah WS berhenti", exc_info=True)
        finally:
            closed.set()

    reader = asyncio.create_task(read_loop())
    last_version = -1
    last_sent = 0.0

    try:
        while not closed.is_set():
            snapshot, version = state_mod.store.snapshot()
            now = time.monotonic()
            # Kirim saat berubah, atau heartbeat 4x/detik supaya klien tahu hidup.
            if version != last_version or (now - last_sent) >= config.WS_HEARTBEAT_INTERVAL:
                await _send(ws, send_lock, protocol.prediction_message(snapshot))
                last_version = version
                last_sent = now
            try:
                await asyncio.wait_for(closed.wait(), timeout=config.WS_SEND_INTERVAL)
            except asyncio.TimeoutError:
                pass
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        reader.cancel()
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")
