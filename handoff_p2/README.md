# Paket P2 → P1 — Wayang Digital Gestur Tangan

**Status:** Tahap 1–3 selesai (rigging + dataset + model).
**Kontrak:** `SDD_Wayang_Digital_Gestur_Tangan_v0.2.docx`.

Paket ini berisi **wayang 2D yang bisa digerakkan** dan **model pengenal 6
gestur** untuk aplikasi webcam. Semua gambar sudah inline di dalam SVG, jadi
tidak ada file gambar eksternal yang perlu di-load.

---

## 1. Isi paket

```
handoff_p2/
├── README.md                  ← dokumen ini
├── requirements.txt
├── test_handoff.py            ← uji cepat model + normalisasi
├── model.pkl                  ← model utama (MLP)
├── labels.json                ← urutan 6 label
├── normalization.py           ← 21 landmark → 63 angka (Bab 4)
├── inference.py               ← pembungkus model → JSON kontrak
├── hand_landmarker.task       ← model MediaPipe (7,6 MB)
├── wayang.svg                 ← 2 wayang, self-contained
├── wayang_kiri.svg            ← 1 wayang (preview)
├── wayang_kanan.svg           ← 1 wayang (preview)
├── pivots.json                ← koordinat pivot tiap sendi
├── landmarks.csv              ← dataset (bahan laporan, tidak dipakai runtime)
├── evaluation.json            ← metrik model
├── DEVIATION.md               ← deviasi yang harus diketahui P1
├── manifest.json              ← ukuran + SHA-256 tiap file
└── docs/
    ├── MODEL.md
    ├── DATASET.md
    ├── dataset_meta.json
    ├── model_comparison.png
    ├── confusion_mlp.png
    └── confusion_rf.png
```

> Catatan: file di `docs/` adalah salinan dokumentasi proyek P2. Path di
> dalamnya (mis. `models/`, `analysis/`) mengacu ke struktur proyek P2, bukan
> ke paket ini. Untuk integrasi, pakai `README.md` ini.

## 2. Mulai cepat

```powershell
py -3.11 -m pip install -r requirements.txt
py -3.11 test_handoff.py
```

Harapan: `HANDOFF OK`, akurasi sampel 60/60 (100%). Jika kurang dari 95%,
berarti versi scikit-learn berbeda — pakai `scikit-learn==1.8.0`.

---

## 3. Integrasi model

### 3.1 Load sekali saat startup

```python
from inference import GesturePredictor

predictor = GesturePredictor()   # load model.pkl + labels.json
```

### 3.2 Per frame (setelah MediaPipe)

```python
hasil = predictor.predict_json(
    [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark],
    image_size=(frame_w, frame_h),
)
```

- `lm.x/lm.y` dari MediaPipe = koordinat ternormalisasi 0..1.
- `image_size` **wajib** diisi ukuran frame asli (bukan ukuran preview),
  supaya bentuk tangan tidak gepeng karena aspect ratio.
- `predict_json` mengembalikan tepat kontrak SDD:

```json
{"gesture": "telapak_terbuka", "confidence": 0.984,
 "wrist_x": 0.523, "wrist_y": 0.833, "state": "ok"}
```

Kirim objek itu ke `ws://localhost:8000/ws/predict`.

### 3.3 Status dan confidence

Sesuai SDD:

| Kondisi | Nilai |
|---|---|
| Tangan terdeteksi, confidence ≥ 0,60 | label gestur |
| Confidence < 0,60 | `"gesture": "unknown"` |
| Tidak ada tangan | `"gesture": "no_hand"` |

`state` diisi P1 (default `"ok"`). Disarankan **smoothing** mayoritas 5 frame
sebelum menggerakkan wayang, supaya animasi tidak jitter.

### 3.4 Jangan

- Jangan kirim 21 landmark mentah ke model — harus lewat `normalization.py`
  (63 angka).
- Jangan pakai `z` asli MediaPipe. Model dilatih 2D (`z=0`).
- Jangan rename label atau mengubah urutannya (`labels.json`).
- `model.pkl` mengeluarkan **indeks 0..5**; `inference.py` sudah memetakannya
  ke nama label.

---

## 4. Model

| Aspek | MLP (utama) | Random Forest (pembanding) |
|---|---:|---:|
| Akurasi test | **99,74%** | 99,64% |
| F1-macro | 0,9974 | 0,9964 |
| Ukuran | **0,4 MB** | 24,8 MB |
| Inferensi | **0,0018 ms/sampel** | 0,0077 ms/sampel |
| Dipakai aplikasi | **YA** (`model.pkl`) | tidak |

Arsitektur: 63 → 128 → 64 → 6 (ReLU, Adam, early stopping), CPU tanpa GPU.
Grafik: `docs/model_comparison.png`; metrik lengkap: `evaluation.json`.

> Akurasi 99,74% diukur pada **test HaGRID** (24.000 sampel, subjek terpisah).
> Landmark HaGRID juga dibuat MediaPipe, jadi akurasi webcam live bisa lebih
> rendah. Uji kamera tetap perlu; jika kurang, rekam data sendiri dengan
> `record_data.py` (ada di folder proyek P2) lalu latih ulang.

---

## 5. Wayang SVG

`wayang.svg` berisi dua wayang (kiri + kanan) dalam satu kanvas.
`wayang_kiri.svg` / `wayang_kanan.svg` untuk preview terpisah.

### ID layer

```
#grup-wayang
  #badan
  #lengan-atas-kiri   →  #lengan-bawah-kiri   (nested)
  #lengan-atas-kanan  →  #lengan-bawah-kanan  (nested)
```

Wayang kedua memakai sufiks **`-2`**: `#badan-2`, `#lengan-atas-kiri-2`, dst.
Di `wayang_kanan.svg` (file terpisah) ID tanpa sufiks.

### Rotasi

Pivot ada di `data-pivot-x` / `data-pivot-y` dan di `pivots.json`.

```js
function putar(id, deg) {
  const el = document.getElementById(id);
  el.setAttribute('transform',
    `rotate(${deg} ${el.dataset.pivotX} ${el.dataset.pivotY})`);
}

putar('lengan-atas-kiri', 18);    // angkat bahu kiri
putar('lengan-atas-kanan', -18);  // angkat bahu kanan
```

- `deg` **positif = searah jarum jam** (sumbu y ke bawah).
- `#lengan-bawah-*` ada di dalam `#lengan-atas-*`; siku ikut saat bahu diputar.
- Rentang aman: bahu ±25°, siku −40°…+15° (kiri) / −15°…+40° (kanan).

### Deviasi

| ID SDD | Status | Solusi |
|---|---|---|
| `#kepala` | tidak ada (menyatu dengan badan) | putar `#grup-wayang` 6–10° untuk menunduk |
| `#tongkat` | tidak ada (menempel di tangan) | angkat `#lengan-bawah-*`; batang ikut |

Detail + tabel arah rotasi: **`DEVIATION.md`**.

### Aksi per gestur (SDD)

| Gestur | Aksi wayang |
|---|---|
| `telapak_terbuka` | angkat kedua lengan |
| `kepalan` | turunkan lengan, diam |
| `telunjuk` | wayang bergeser ikut `wrist_x/wrist_y` |
| `dua_jari` | angkat tongkat (lengan bawah) |
| `jempol` | menunduk (putar grup 6–10°) |
| `ok` | berbalik arah (mirror) |

---

## 6. Dataset (bahan laporan)

- 64.429 baris: 4.000 train + 4.000 test per gestur; val 16.429.
- Sumber: **HaGRID v2** (anotasi landmark), bukan rekaman sendiri.
- Split resmi HaGRID per subjek; **0 user** bocor train → test.
- Gestur `telunjuk` memakai kelas HaGRID **`one`** (bukan `point`).
- Landmark 2D → `z = 0`.

`landmarks.csv` **tidak diperlukan saat runtime**; itu bahan laporan Bab 4.
Detail: `docs/DATASET.md` + `docs/dataset_meta.json`.

---

## 7. Troubleshooting

| Masalah | Solusi |
|---|---|
| `ImportError: runtime_version` dari protobuf | Jangan pakai mediapipe 0.10.14 + TF 2.21. Paket ini memakai **mediapipe 0.10.35**. |
| Startup 10–20 detik | MediaPipe meng-import TensorFlow bila terpasang (hanya docstring). Normal. |
| Kamera tidak terbuka | Izinkan akses kamera di Windows; tutup Zoom/Meet yang memakai kamera. |
| Akurasi live rendah | Uji pencahayaan; rekam data sendiri lalu latih ulang. |
| `InconsistentVersionWarning` | scikit-learn harus **1.8.0**. |

---

## 8. Versi

- Python **3.11**
- scikit-learn **1.8.0**, joblib 1.5.3, numpy 2.4.6
- mediapipe **0.10.35**, OpenCV 4.11.0
- Model dilatih 20 Oktober 2026 dari HaGRID v2.

---

## 9. Checklist integrasi P1

- [ ] `pip install -r requirements.txt`
- [ ] `test_handoff.py` lulus
- [ ] `GesturePredictor` di-load sekali saat startup
- [ ] MediaPipe → `predict_json(..., image_size=(w,h))`
- [ ] Kirim JSON ke `ws://localhost:8000/ws/predict`
- [ ] Threshold 0,60 + smoothing 5 frame
- [ ] Animasi SVG pakai ID + pivot di `pivots.json`
- [ ] Uji 6 gestur di webcam
