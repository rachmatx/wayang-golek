"""Run the local app on the port supplied by the preview host."""
import os
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
args, _ = parser.parse_known_args()
os.environ["WAYANG_HOST"] = args.host
os.environ["WAYANG_PORT"] = str(args.port)

if __name__ == "__main__":
    from backend.app import app
    from fastapi.staticfiles import StaticFiles
    from pathlib import Path
    import uvicorn
    # QA fixtures are served by this preview entry point only, not the normal app.
    app.mount("/__qa", StaticFiles(directory=Path(__file__).resolve().parents[2] / "frontend" / "tools"))
    uvicorn.run(app, host=args.host, port=args.port)
