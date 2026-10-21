"""
Normalisasi landmark tangan — SATU-SATUNYA versi yang dipakai.

Aturan Bab 4 SDD:
  untuk tiap dari 21 landmark:
      x' = (x - x_wrist) / dist
      y' = (y - y_wrist) / dist
      z' = (z - z_wrist) / dist
  dist = jarak 2D titik 0 (wrist) ke titik 9 (pangkal jari tengah)
  hasil = 63 angka (21 x 3)

Catatan penting:
- `dist` dihitung 2D (x,y), bukan 3D. Dataset HaGRID memakai z=0; kalau
  dist memakai z, skala training dan live (z MediaPipe asli) akan beda.
- Koordinat HARUS dalam piksel. MediaPipe memberi x,y ternormalisasi 0..1
  (x dibagi lebar, y dibagi tinggi). Kalau langsung dipakai, bentuk tangan
  ikut terdistorsi sesuai aspect ratio frame. Karena itu fungsi ini menerima
  `image_size=(width, height)` dan mengalikannya lebih dulu.
- z selalu di-set 0 (use_z=False). Dataset HaGRID hanya 2D; kalau live
  memakai z asli MediaPipe, input model beda dari data training. Jika suatu
  saat ada dataset 3D, panggil use_z=True DAN latih ulang modelnya.

Contoh pemakaian di backend (P1):

    from normalization import normalize_landmarks

    pts = [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark]  # 21 titik
    fitur = normalize_landmarks(pts, image_size=(frame_w, frame_h))  # 63 float
"""
from __future__ import annotations

import numpy as np

N_LANDMARKS = 21
N_FEATURES = N_LANDMARKS * 3  # 63


def normalize_landmarks(landmarks, image_size=None, use_z=False):
    """Ubah 21 landmark jadi 63 angka ternormalisasi.

    Parameters
    ----------
    landmarks : sequence
        21 titik, tiap titik (x, y) atau (x, y, z).
        Boleh koordinat ternormalisasi 0..1 (MediaPipe/HaGRID) bila
        `image_size` diisi, atau sudah dalam piksel bila `image_size=None`.
    image_size : (width, height), optional
        Ukuran gambar asal. Kalau diisi, x dan y dianggap ternormalisasi 0..1
        lalu dikalikan lebar/tinggi.
    use_z : bool, default False
        False = komponen z selalu 0 (sesuai dataset HaGRID 2D / Opsi B).
        Jangan diubah saat memakai model yang dilatih dari HaGRID: model
        tidak pernah melihat z, jadi z asli MediaPipe justru merusak prediksi.

    Returns
    -------
    list[float]
        63 angka, urut x0,y0,z0, x1,y1,z1, ..., x20,y20,z20.
    """
    pts = np.asarray(landmarks, dtype=np.float64)
    if pts.ndim != 2 or pts.shape[0] != N_LANDMARKS:
        raise ValueError(f"butuh 21 landmark, dapat {pts.shape}")
    if pts.shape[1] == 2:
        pts = np.hstack([pts, np.zeros((N_LANDMARKS, 1))])
    elif pts.shape[1] != 3:
        raise ValueError(f"tiap landmark harus (x,y) atau (x,y,z), dapat {pts.shape[1]}")

    if not np.isfinite(pts).all():
        raise ValueError("ada koordinat NaN/inf")

    if image_size is not None:
        w, h = float(image_size[0]), float(image_size[1])
        if w <= 0 or h <= 0:
            raise ValueError("image_size tidak valid")
        pts[:, 0] *= w
        pts[:, 1] *= h

    wrist = pts[0].copy()
    rel = pts - wrist
    dist = float(np.hypot(rel[9, 0], rel[9, 1]))
    if dist < 1e-6:
        raise ValueError("dist titik 0->9 nol, landmark tidak valid")

    out = rel / dist
    if not use_z:
        out[:, 2] = 0.0
    return out.reshape(-1).tolist()


def feature_names():
    return [f"{axis}{i}" for i in range(N_LANDMARKS) for axis in ("x", "y", "z")]
