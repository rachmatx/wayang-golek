"""Cek kontrak rig SVG wayang yang dibaca animation.js.

Setiap berkas harus punya #grup-wayang, #badan, empat lengan dengan nesting
bahu -> siku, dan data-pivot-x/y di tiap lengan. Isi layer bebas: vector
(wayang.svg) maupun raster hasil build_wayang_raster.py (Arjuna, Cepot,
Gatotkaca).

Jalankan:  python frontend/tools/check_wayang_rig.py
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / "assets"

FILES = [
    "wayang.svg",
    "wayang-arjuna.svg",
    "wayang-gatotkaca.svg",
    "wayang-cepot.svg",
]

REQUIRED = [
    "grup-wayang",
    "badan",
    "lengan-atas-kiri",
    "lengan-bawah-kiri",
    "lengan-atas-kanan",
    "lengan-bawah-kanan",
]

NESTED = {
    "lengan-bawah-kiri": "lengan-atas-kiri",
    "lengan-bawah-kanan": "lengan-atas-kanan",
}

PIVOT_LAYERS = [
    "lengan-atas-kiri",
    "lengan-bawah-kiri",
    "lengan-atas-kanan",
    "lengan-bawah-kanan",
]


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def index_elements(root: ET.Element):
    by_id: dict[str, ET.Element] = {}
    parents: dict[ET.Element, ET.Element] = {}
    for parent in root.iter():
        for child in parent:
            parents[child] = parent
        node_id = parent.get("id")
        if node_id:
            by_id[node_id] = parent
    return by_id, parents


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        return [f"XML tidak valid: {error}"]

    if local_name(root.tag) != "svg":
        errors.append("akar bukan <svg>")
    if not root.get("width") or not root.get("height"):
        errors.append("akar <svg> harus punya width/height (layout .wayang-svg bergantung padanya)")
    viewbox = root.get("viewBox", "")
    parts = viewbox.replace(",", " ").split()
    if len(parts) != 4:
        errors.append(f"viewBox tidak valid: {viewbox!r}")
        width = height = 0.0
    else:
        width, height = float(parts[2]), float(parts[3])
        if width <= 0 or height <= 0:
            errors.append(f"viewBox tidak punya ukuran positif: {viewbox!r}")

    by_id, parents = index_elements(root)
    for node_id in REQUIRED:
        if node_id not in by_id:
            errors.append(f"#{node_id} tidak ada")

    for child_id, parent_id in NESTED.items():
        child = by_id.get(child_id)
        parent = by_id.get(parent_id)
        if child is None or parent is None:
            continue
        walker = parents.get(child)
        found = False
        while walker is not None:
            if walker is parent:
                found = True
                break
            walker = parents.get(walker)
        if not found:
            errors.append(f"#{child_id} harus berada di dalam #{parent_id}")

    pivots: dict[str, tuple[float, float]] = {}
    for layer in PIVOT_LAYERS:
        element = by_id.get(layer)
        if element is None:
            continue
        raw_x = element.get("data-pivot-x")
        raw_y = element.get("data-pivot-y")
        if raw_x is None or raw_y is None:
            errors.append(f"#{layer} tidak punya data-pivot-x/y")
            continue
        try:
            px, py = float(raw_x), float(raw_y)
        except ValueError:
            errors.append(f"#{layer} pivot bukan angka: {raw_x!r}, {raw_y!r}")
            continue
        if width and height and not (0 <= px <= width and 0 <= py <= height):
            errors.append(f"#{layer} pivot ({px}, {py}) di luar viewBox")
        pivots[layer] = (px, py)

    if "lengan-atas-kiri" in pivots and "lengan-atas-kanan" in pivots:
        if pivots["lengan-atas-kiri"] == pivots["lengan-atas-kanan"]:
            errors.append("pivot bahu kiri dan kanan tidak boleh sama")

    return errors


def main() -> int:
    failed = False
    for name in FILES:
        path = ASSETS / name
        if not path.exists():
            print(f"GAGAL {name}: berkas tidak ada")
            failed = True
            continue
        errors = check_file(path)
        if errors:
            failed = True
            print(f"GAGAL {name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK    {name}  ({path.stat().st_size / 1024:.1f} KB)")

    print("HASIL:", "GAGAL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
