"""Pecah art raster hasil ImageGen menjadi 5 layer rig, lalu rakit SVG.

Input: PNG RGBA 444x562 yang sudah di-chroma-key dan dinormalisasi
(vibe_images/<karakter>_normalized.png). Output: layer PNG per bagian,
crop sesuai bbox, ditempel balik sebagai <image> base64 di
frontend/assets/wayang-<karakter>.svg dengan ID dan pivot yang sama
seperti rig P2.

Jalankan:
    .venv/Scripts/python.exe frontend/tools/build_wayang_raster.py gatotkaca
"""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "frontend" / "assets"
DEBUG = ROOT / "vibe_images" / "layers-debug"

# Pivot dan garis potong dibaca dari art ternormalisasi 444x562.
# kiri = sisi kiri layar (tangan pemegang batang), kanan = sisi kanan layar.
RIGS = {
    "gatotkaca": {
        "source": ROOT / "vibe_images" / "gatotkaca_normalized.png",
        "output": "wayang-gatotkaca.svg",
        "title": "Wayang Gatotkaca",
        "pivots": {
            "lengan-atas-kiri": (103, 141),
            "lengan-bawah-kiri": (74, 244),
            "lengan-atas-kanan": (240, 160),
            "lengan-bawah-kanan": (303, 219),
        },
        "polygons": {
            "lengan-atas-kiri": [
                (95, 120), (112, 124), (112, 148), (106, 168),
                (102, 190), (98, 210), (97, 230), (95, 250),
                (58, 250), (56, 230), (58, 205), (52, 190),
                (52, 172), (60, 160), (72, 150), (84, 136),
            ],
            "lengan-bawah-kiri": [
                (66, 228), (92, 228), (90, 255), (88, 280),
                (88, 310), (88, 340), (88, 365), (84, 392),
                (50, 398), (44, 370), (44, 340), (48, 315),
                (50, 290), (56, 262), (60, 240),
            ],
            "lengan-atas-kanan": [
                (222, 136), (248, 150), (262, 140), (286, 148),
                (300, 164), (304, 186), (322, 210), (320, 234),
                (296, 240), (272, 222), (250, 204), (234, 186),
                (224, 160),
            ],
            "lengan-bawah-kanan": [
                (286, 212), (296, 236), (320, 232), (334, 208),
                (344, 184), (352, 166), (364, 152), (380, 142),
                (396, 130), (400, 120), (388, 113), (366, 116),
                (348, 124), (336, 136), (326, 142), (314, 152),
                (300, 174), (290, 194),
            ],
        },
        # Lingkaran penutup sendi: bahu disimpan juga di badan supaya tidak
        # bolong saat lengan diangkat.
        # "socket" bahu: kaki lengan yang ikut terpotong dicat ulang warna
        # kulit dan ditaruh di badan, supaya saat lengan diangkat yang
        # terlihat sendi biru, bukan potongan pauldron yang diam.
        "shoulder_sockets": {"badan": []},
        # Potong pangkal lengan dengan lingkaran berpusat di pivot, lalu simpan
        # potongan itu di badan. Batas potongan ikut berputar bersama lengan,
        # jadi sendi selalu rapat tanpa lubang latar.
        "shoulder_cut": {
            "lengan-atas-kiri": 20,
            "lengan-atas-kanan": 20,
        },
        # Tongkat gapit lurus di sisi kiri layar dan tertutup gelangan serta
        # telapak tangan kiri. Saat lengan diputar, batang aslinya hilang
        # bersama layer lengan; isi ulang dengan batang statis di belakangnya.
        "rod_hidden": {
            "x": 57, "y": 165, "w": 12, "h": 235,
            "sample": (57, 420, 10, 60),
        },
        # Di rentang ini tongkat menempel di tepi lengan kiri: jangan sampai
        # pixel batangnya terserap ke layer lengan dan ikut berputar.
        "rod_clear": (56, 71, 150, 405),
        # Batang gapit nyaris hitam (median 38) sementara merah tuanya gelangan
        # ada di 65-90, jadi ambangnya diturunkan supaya ornamennya tidak bolong.
        "rod_max_gray": 55,
    },
    "arjuna": {
        "source": ROOT / "vibe_images" / "arjuna_normalized.png",
        "output": "wayang-arjuna.svg",
        "title": "Wayang Arjuna",
        "pivots": {
            "lengan-atas-kiri": (156, 116),
            "lengan-bawah-kiri": (136, 212),
            "lengan-atas-kanan": (245, 130),
            "lengan-bawah-kanan": (275, 214),
        },
        "polygons": {
            "lengan-atas-kiri": [
                (148, 95), (157, 100), (157, 125), (156, 150),
                (155, 175), (153, 200), (152, 226), (120, 226),
                (120, 212), (123, 195), (127, 175), (132, 155),
                (136, 140), (141, 120), (145, 104),
            ],
            "lengan-bawah-kiri": [
                (150, 220), (148, 228), (142, 232), (138, 244),
                (134, 256), (130, 268), (126, 282), (124, 298),
                (125, 314), (126, 334), (122, 350), (112, 356),
                (100, 351), (94, 338), (96, 320), (100, 300),
                (104, 285), (108, 268), (112, 252), (116, 236),
                (120, 220), (118, 204),
            ],
            "lengan-atas-kanan": [
                (226, 114), (247, 117), (250, 132), (254, 148),
                (258, 165), (262, 182), (266, 200), (278, 210),
                (290, 218), (286, 228), (262, 230), (248, 218),
                (243, 202), (240, 187), (237, 172), (234, 157),
                (232, 145), (228, 132),
            ],
            "lengan-bawah-kanan": [
                (243, 209), (264, 214), (274, 208), (282, 199),
                (290, 190), (298, 181), (306, 172), (314, 163),
                (320, 155), (324, 147), (326, 138), (332, 128),
                (340, 121), (349, 118), (350, 126), (344, 136),
                (338, 145), (334, 153), (330, 160), (324, 168),
                (316, 176), (308, 184), (300, 193), (292, 202),
                (284, 211), (276, 218), (268, 219), (253, 222),
            ],
        },
        "shoulder_sockets": {"badan": []},
        # Potong pangkal lengan dengan lingkaran berpusat di pivot, lalu simpan
        # potongan itu di badan. Batas potongan ikut berputar bersama lengan,
        # jadi sendi selalu rapat tanpa lubang latar.
        "shoulder_cut": {
            "lengan-atas-kiri": 24,
            "lengan-atas-kanan": 18,
        },
    },
    "cepot": {
        "source": ROOT / "vibe_images" / "cepot_normalized.png",
        "output": "wayang-cepot.svg",
        "title": "Wayang Cepot",
        "pivots": {
            "lengan-atas-kiri": (135, 150),
            "lengan-bawah-kiri": (104, 203),
            "lengan-atas-kanan": (300, 180),
            "lengan-bawah-kanan": (325, 202),
        },
        "polygons": {
            "lengan-atas-kiri": [
                (140, 138), (176, 143), (171, 156), (166, 168),
                (158, 178), (150, 188), (143, 198), (136, 208),
                (128, 220), (96, 220), (86, 205), (84, 192),
                (92, 178), (100, 168), (112, 157), (122, 148),
                (134, 141),
            ],
            "lengan-bawah-kiri": [
                (122, 202), (124, 218), (120, 236), (115, 252),
                (110, 268), (105, 284), (100, 300), (96, 315),
                (93, 330), (90, 342), (84, 352), (78, 362),
                (66, 366), (56, 356), (53, 342), (55, 328),
                (58, 314), (62, 300), (67, 286), (72, 272),
                (77, 258), (81, 244), (85, 230), (89, 214),
                (96, 202),
            ],
            "lengan-atas-kanan": [
                (276, 168), (302, 170), (314, 178), (322, 190),
                (330, 200), (346, 208), (338, 218), (324, 222),
                (316, 224), (310, 208), (304, 198), (296, 190),
                (286, 182), (280, 176),
            ],
            "lengan-bawah-kanan": [
                (300, 204), (306, 214), (318, 228), (330, 226),
                (340, 216), (344, 206), (352, 196), (358, 186),
                (364, 182), (370, 182), (376, 176), (380, 168),
                (382, 158), (378, 146), (382, 134),
                (386, 120), (388, 108), (384, 98), (376, 88),
                (368, 80), (358, 76), (350, 82), (344, 94),
                (340, 106), (338, 118), (340, 132), (342, 146),
                (338, 158), (334, 170), (328, 180), (322, 188),
                (314, 196), (306, 198),
            ],
        },
        "shoulder_sockets": {"badan": []},
        # Potongan kecil saja: ornamen bahu Cepot lebar, kalau lingkarannya
        # besar ornamennya tertinggal di badan dan terlihat melayang.
        "shoulder_cut": {
            "lengan-atas-kiri": 12,
            "lengan-atas-kanan": 12,
        },
        # Salinan bahu netral di lapisan badan, persis selebar celah yang
        # ditinggalkan lengan saat diputar ke pose telapak. Dibatasi radius
        # supaya potongan di dekat siku tidak tertinggal melayang.
        "shoulder_backing": {
            "lengan-atas-kiri": (20, 46),
            "lengan-atas-kanan": (-20, 40),
        },
        # Tongkat di sisi kiri layar lewat di belakang lengan bawah. Saat lengan
        # diputar, bagian yang tadinya tertutup ikut terlihat; isi dengan batang
        # statis di belakang lengan supaya tidak putus.
        "rod_hidden": {
            "x": 94, "y": 176, "w": 9, "h": 160,
            "sample": (94, 350, 9, 120),
        },
        # Di area ini tongkat terlihat menempel di tepi lengan; jangan ikut
        # masuk layer lengan supaya tidak berputar bersama bahu.
        "rod_clear": (88, 106, 145, 200),
        # Kepala tongkat (emas, bukan gelap) di dekat bahu juga tidak boleh
        # ikut terserap ke layer lengan.
        "rod_protect": (100, 104, 128, 142),
    },
}

LAYER_ORDER = [
    "badan",
    "lengan-atas-kiri",
    "lengan-bawah-kiri",
    "lengan-atas-kanan",
    "lengan-bawah-kanan",
]


def polygon_mask(shape, points):
    mask = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(mask, [np.array(points, np.int32)], 255)
    return mask


def circle_mask(shape, cx, cy, radius):
    mask = np.zeros(shape[:2], np.uint8)
    cv2.circle(mask, (int(cx), int(cy)), int(radius), 255, -1)
    return mask


def prune_specks(mask, min_area=40):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (mask > 0).astype(np.uint8), 8
    )
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] < min_area:
            mask[labels == index] = 0
    return mask


def build_masks(alpha, rig, image=None):
    shape = alpha.shape
    arms = {}
    for layer, points in rig["polygons"].items():
        arms[layer] = cv2.bitwise_and(alpha, polygon_mask(shape, points))

    strip = rig.get("rod_clear")
    if strip and image is not None:
        x0, x1, y0, y1 = strip
        gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
        area = np.zeros(shape, np.uint8)
        area[y0:y1, x0:x1] = 1
        # Ornamen lengan ada yang segelap batang, jadi ambangnya bisa diperketat
        # per karakter supaya hanya pixel tongkat yang dibuang.
        ceiling = rig.get("rod_max_gray", 115)
        dark = ((gray < ceiling) & (area > 0)).astype(np.uint8) * 255
        for mask in arms.values():
            mask[dark > 0] = 0

    caps = []
    for layer, radius in rig.get("shoulder_cut", {}).items():
        cx, cy = rig["pivots"][layer]
        disc = circle_mask(shape, cx, cy, radius)
        caps.append((cx, cy, radius, disc))
        arms[layer][disc > 0] = 0

    # Siku tidak diisi di layer raster: penutup wedge dibuat sebagai elemen
    # SVG yang baru muncul saat siku ditekuk (lihat build_svg + animation.js),
    # supaya pose netral tetap memakai art asli tanpa lingkaran palsu.
    for mask in arms.values():
        prune_specks(mask)

    body = alpha.copy()
    for mask in arms.values():
        body[mask > 0] = 0

    # Potongan pangkal lengan disimpan utuh di badan; badan sengaja dilebihkan
    # 3 px supaya tidak ada garis gelap di batas potongan saat lengan berputar.
    for cx, cy, radius, _ in caps:
        disc = circle_mask(shape, cx, cy, radius + 3)
        body[disc > 0] = alpha[disc > 0]

    absorb_leftovers(alpha, image, rig, arms, body, caps)

    for layer, (angle, limit) in rig.get("shoulder_backing", {}).items():
        cx, cy = rig["pivots"][layer]
        # cv2 menghitung sudut berlawanan arah jarum jam, SVG sebaliknya.
        matrix = cv2.getRotationMatrix2D((float(cx), float(cy)), -angle, 1.0)
        posed = cv2.warpAffine(
            (arms[layer] > 0).astype(np.uint8), matrix, (shape[1], shape[0]),
            flags=cv2.INTER_NEAREST,
        )
        near = circle_mask(shape, cx, cy, limit)
        above = np.arange(shape[0])[:, None] < cy + 14
        vacated = (arms[layer] > 0) & (posed == 0) & (near > 0) & above
        body[vacated] = alpha[vacated]

    masks = {"badan": body, **arms}
    return masks


def absorb_leftovers(alpha, image, rig, arms, body, caps):
    """Pindahkan serpihan lengan yang tertinggal di badan ke layer lengan.

    Garis polygon memotong sebagian art di tepi lengan; potongan itu tetap
    berada di badan dan baru terlihat saat lengan berputar. Serpihan kecil
    yang menempel di tepi lengan ditempelkan balik ke layer terdekat. Sendi
    bahu dan tongkat dilindungi supaya tidak ikut berpindah.
    """
    shape = alpha.shape
    protected = np.zeros(shape, np.uint8)
    for cx, cy, radius, _ in caps:
        protected |= circle_mask(shape, cx, cy, radius + 4)
    rod = rig.get("rod_protect")
    if rod:
        x0, y0, x1, y1 = rod
        protected[y0:y1, x0:x1] = 255
    gray = (
        cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
        if image is not None
        else None
    )
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (body > 0).astype(np.uint8), 8
    )
    kernel = np.ones((3, 3), np.uint8)
    for index in range(1, count):
        x, y, w, h, area = stats[index]
        if area > 4000:
            continue
        comp = labels == index
        if np.any(protected[comp]):
            continue
        if gray is not None and float(gray[comp].mean()) < 90:
            continue
        near = cv2.dilate(comp.astype(np.uint8), kernel, iterations=1) > 0
        contact = {
            layer: int((near & (mask > 0)).sum()) for layer, mask in arms.items()
        }
        layer = max(contact, key=contact.get)
        if contact[layer] < 8:
            continue
        add = comp & (alpha > 0)
        arms[layer][add] = alpha[add]
        body[comp] = 0


def skin_color(image, mask, cx, cy):
    band = mask[cy + 8:cy + 34, cx - 14:cx + 14]
    pixels = image[cy + 8:cy + 34, cx - 14:cx + 14, :3][band > 0]
    if len(pixels) == 0:
        return np.array([90, 90, 90], np.float32)
    return np.median(pixels, axis=0)


def paint_sockets(image, masks, rig):
    """Cat ulang kaki lengan di bahu jadi sendi kulit, di lapisan badan."""
    out = image.copy()
    body = masks["badan"]
    for cx, cy, radius, arm_layer in rig.get("shoulder_sockets", {}).get("badan", []):
        disc = circle_mask(out.shape, cx, cy, radius)
        socket = cv2.bitwise_and(masks[arm_layer], disc)
        ys, xs = np.nonzero(socket)
        if len(xs) == 0:
            continue
        color = skin_color(out, masks[arm_layer], cx, cy)
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        shade = (1.04 - 0.26 * (d / radius) ** 2)[:, None]
        out[ys, xs, :3] = np.clip(color * shade, 0, 255).astype(np.uint8)
        feather = np.clip((radius - d) / 4.0, 0.0, 1.0)
        socket_alpha = (masks[arm_layer][ys, xs].astype(np.float32) * feather).astype(np.uint8)
        body[ys, xs] = np.maximum(body[ys, xs], socket_alpha)
    return out


def cut_layer(image, alpha_mask, crop=True):
    layer = image.copy()
    layer[:, :, 3] = alpha_mask
    if not crop:
        return layer, (0, 0, image.shape[1], image.shape[0])
    ys, xs = np.nonzero(alpha_mask)
    if len(xs) == 0:
        raise ValueError("layer kosong — cek polygon/pivot")
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    x0, y0 = max(0, x0 - 1), max(0, y0 - 1)
    x1 = min(image.shape[1] - 1, x1 + 1)
    y1 = min(image.shape[0] - 1, y1 + 1)
    return layer[y0:y1 + 1, x0:x1 + 1], (x0, y0, x1 - x0 + 1, y1 - y0 + 1)


def png_base64(rgba):
    ok, buffer = cv2.imencode(".png", rgba)
    if not ok:
        raise RuntimeError("gagal encode PNG")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def save_debug(name, rgba):
    DEBUG.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(DEBUG / f"{name}.png"), rgba)
    w, h = rgba.shape[1], rgba.shape[0]
    board = np.full((h, w, 3), 236, np.uint8)
    alpha = rgba[:, :, 3:4].astype(np.float32) / 255
    board = (rgba[:, :, :3].astype(np.float32) * alpha + board * (1 - alpha)).astype(np.uint8)
    cv2.imwrite(str(DEBUG / f"{name}_preview.png"), board)


def color_hex(color_bgr):
    return "#{:02x}{:02x}{:02x}".format(
        int(color_bgr[2]), int(color_bgr[1]), int(color_bgr[0])
    )


def build_svg(rig, layers, rod_color=None):
    x, y = rig["pivots"]["lengan-atas-kiri"]
    x2, y2 = rig["pivots"]["lengan-bawah-kiri"]
    x3, y3 = rig["pivots"]["lengan-atas-kanan"]
    x4, y4 = rig["pivots"]["lengan-bawah-kanan"]

    def image_tag(name):
        rgba, (ix, iy, iw, ih) = layers[name]
        return (
            f'      <image x="{ix}" y="{iy}" width="{iw}" height="{ih}" '
            f'preserveAspectRatio="none" href="data:image/png;base64,{png_base64(rgba)}"/>'
        )

    def body_tag():
        rgba, _ = layers["badan"]
        return (
            f'    <g id="badan"><image x="0" y="0" width="444" height="562" '
            f'preserveAspectRatio="none" href="data:image/png;base64,{png_base64(rgba)}"/></g>'
        )

    rod_tag = ""
    rod = rig.get("rod_hidden")
    if rod and rod_color:
        rod_tag = (
            f'    <rect id="batang-tersembunyi" x="{rod["x"]}" y="{rod["y"]}" '
            f'width="{rod["w"]}" height="{rod["h"]}" fill="{rod_color}"/>\n'
        )

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="444" height="562" viewBox="0 0 444 562">
<title>{rig["title"]} - rig 5 layer</title>
<desc>Rig wayang 2D 5 layer. Art raster ditempel per bagian; pivot bahu/siku ada di data-pivot-x/y.</desc>
  <g id="grup-wayang">
{body_tag()}
{rod_tag}    <g id="lengan-atas-kiri" data-pivot-x="{x}" data-pivot-y="{y}" transform="rotate(0 {x} {y})">
{image_tag("lengan-atas-kiri")}
      <g id="lengan-bawah-kiri" data-pivot-x="{x2}" data-pivot-y="{y2}" transform="rotate(0 {x2} {y2})">
{image_tag("lengan-bawah-kiri")}
      </g>
    </g>
    <g id="lengan-atas-kanan" data-pivot-x="{x3}" data-pivot-y="{y3}" transform="rotate(0 {x3} {y3})">
{image_tag("lengan-atas-kanan")}
      <g id="lengan-bawah-kanan" data-pivot-x="{x4}" data-pivot-y="{y4}" transform="rotate(0 {x4} {y4})">
{image_tag("lengan-bawah-kanan")}
      </g>
    </g>
  </g>
</svg>
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("character", choices=sorted(RIGS))
    args = parser.parse_args()
    rig = RIGS[args.character]

    image = cv2.imread(str(rig["source"]), cv2.IMREAD_UNCHANGED)
    if image is None:
        print(f"GAGAL: {rig['source']} tidak terbaca")
        return 1
    if image.shape[0] != 562 or image.shape[1] != 444:
        print(f"GAGAL: ukuran {image.shape[1]}x{image.shape[0]}, harus 444x562")
        return 1
    if image.shape[2] != 4:
        print("GAGAL: butuh PNG RGBA (hasil chroma-key)")
        return 1

    alpha = image[:, :, 3]
    masks = build_masks(alpha, rig, image)
    body_image = paint_sockets(image, masks, rig)
    layers = {}
    for name in LAYER_ORDER:
        source = body_image if name == "badan" else image
        rgba, bbox = cut_layer(source, masks[name], crop=name != "badan")
        layers[name] = (rgba, bbox)
        save_debug(f"{args.character}-{name}", rgba)
        print(f"{name:18s} bbox x={bbox[0]} y={bbox[1]} w={bbox[2]} h={bbox[3]}")

    rod_color = None
    rod = rig.get("rod_hidden")
    if rod:
        sx, sy, sw, sh = rod["sample"]
        patch = image[sy:sy + sh, sx:sx + sw, :3].reshape(-1, 3)
        color = np.median(patch, axis=0)
        rod_color = color_hex(color)

    svg = build_svg(rig, layers, rod_color)
    out = ASSETS / rig["output"]
    out.write_text(svg, encoding="utf-8")
    print(f"OK: {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
