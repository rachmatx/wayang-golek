"""Render rig SVG ke PNG untuk cek visual tanpa browser.

Membaca <image> base64 dan transform grup, memutar layer sesuai pose, lalu
mengomposit di atas latar gelap panggung.

Jalankan:
    .venv/Scripts/python.exe frontend/tools/preview_wayang.py arjuna cepot
"""
from __future__ import annotations

import base64
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "frontend" / "assets"
OUT = ROOT / "vibe_images"

WIDTH, HEIGHT = 444, 562
BG = (12, 8, 6)
POSES = {
    "netral": {},
    "telapak_terbuka": {"lengan-atas-kiri": 20.0, "lengan-atas-kanan": -20.0},
    "dua_jari": {"lengan-atas-kiri": 8.0, "lengan-bawah-kiri": -14.0},
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def rotation(deg: float, cx: float, cy: float) -> np.ndarray:
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([
        [c, -s, cx - c * cx + s * cy],
        [s, c, cy - s * cx - c * cy],
        [0.0, 0.0, 1.0],
    ])


def collect(node, angles, matrix, items):
    for child in node:
        tag = local_name(child.tag)
        if tag == "g":
            walker = matrix
            pivot_x = child.get("data-pivot-x")
            if pivot_x is not None:
                angle = angles.get(child.get("id"), 0.0)
                walker = matrix @ rotation(
                    angle, float(pivot_x), float(child.get("data-pivot-y"))
                )
            collect(child, angles, walker, items)
        elif tag in {"image", "rect"}:
            items.append((child, matrix))


def decode(href: str) -> np.ndarray | None:
    if "base64," not in href:
        return None
    raw = base64.b64decode(href.split("base64,", 1)[1])
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_UNCHANGED)


def blit(canvas, rgba, matrix):
    alpha = rgba[:, :, 3].astype(np.float32) / 255.0
    color = rgba[:, :, :3].astype(np.float32)
    dst_color = cv2.warpAffine(
        color, matrix[:2], (WIDTH, HEIGHT), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    dst_alpha = cv2.warpAffine(
        alpha, matrix[:2], (WIDTH, HEIGHT), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    dst_alpha = dst_alpha[..., None]
    return dst_color * dst_alpha + canvas * (1.0 - dst_alpha)


def render(svg_path: Path, angles: dict[str, float]) -> np.ndarray:
    root = ET.parse(svg_path).getroot()
    items: list[tuple[ET.Element, np.ndarray]] = []
    collect(root, angles, np.eye(3), items)

    canvas = np.zeros((HEIGHT, WIDTH, 3), np.float32)
    canvas[:] = BG

    for element, matrix in items:
        if local_name(element.tag) == "image":
            rgba = decode(element.get("href", ""))
            if rgba is None or rgba.shape[2] != 4:
                continue
            x = float(element.get("x", 0))
            y = float(element.get("y", 0))
            place = matrix @ np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)
            canvas = blit(canvas, rgba, place)
        else:
            fill = element.get("fill", "#000000").lstrip("#")
            rgb = np.array([
                int(fill[4:6], 16), int(fill[2:4], 16), int(fill[0:2], 16)
            ], np.float32)
            w = int(float(element.get("width", 0)))
            h = int(float(element.get("height", 0)))
            if w <= 0 or h <= 0:
                continue
            patch = np.zeros((h, w, 4), np.uint8)
            patch[:, :, :3] = rgb.astype(np.uint8)
            patch[:, :, 3] = 255
            x = float(element.get("x", 0))
            y = float(element.get("y", 0))
            place = matrix @ np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)
            canvas = blit(canvas, patch, place)

    return np.clip(canvas, 0, 255).astype(np.uint8)


def main() -> int:
    names = sys.argv[1:]
    if not names:
        print("pakai: preview_wayang.py <karakter> [...]")
        return 1

    for name in names:
        svg = ASSETS / f"wayang-{name}.svg"
        if not svg.exists():
            print(f"GAGAL: {svg.name} tidak ada")
            continue
        panels = []
        for pose, angles in POSES.items():
            frame = render(svg, angles)
            frame = cv2.resize(frame, None, fx=2, fy=2, interpolation=cv2.INTER_LINEAR)
            frame = cv2.copyMakeBorder(
                frame, 36, 8, 8, 8, cv2.BORDER_CONSTANT, value=BG
            )
            cv2.putText(
                frame, pose, (16, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                (210, 181, 120), 2, cv2.LINE_AA,
            )
            panels.append(frame)
        sheet = np.hstack(panels)
        out = OUT / f"preview-{name}.png"
        cv2.imwrite(str(out), sheet)
        print(f"OK: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
