# DATASET — Landmark Gestur Tangan

Dokumen ini menjelaskan cara `landmarks.csv` dibentuk dari anotasi HaGRID v2.
Dataset ini adalah **input model** (bukan gambar), sesuai kontrak SDD Bab 4:
21 landmark → 63 angka ternormalisasi.

## Sumber

- **HaGRID v2 — `annotations_with_landmarks`**
- URL: `https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/hagrid_v2/annotations_with_landmarks/annotations.zip`
- Ukuran: 719 MB (hanya anotasi + landmark, **bukan** 1,5 TB gambar)
- Gambar asli HaGRID: FullHD 1920×1080
- Landmark: 21 titik 2D (x,y) ternormalisasi 0..1, hasil anotasi MediaPipe

Gambar tidak diunduh karena model hanya memakai landmark. Ini juga
menghindari kebutuhan penyimpanan 1,5 TB.

## Mapping kelas HaGRID → label SDD

| Label SDD | Kelas HaGRID | Alasan |
|---|---|---|
| `telapak_terbuka` | `palm` | telapak terbuka, 5 jari |
| `kepalan` | `fist` | semua jari tergenggam |
| `telunjuk` | `one` | **bukan `point`** — lihat catatan di bawah |
| `dua_jari` | `two_up` | telunjuk + jari tengah |
| `jempol` | `like` | jempol ke atas |
| `ok` | `ok` | jempol + telunjuk membentuk lingkaran |

### Kenapa `one`, bukan `point`?

Rencana awal memakai `point`. Setelah diukur pada landmark 2D:

| Kelas | Sampel dengan tepat 1 jari terentang |
|---|---|
| `one` | **96,4%** |
| `point` | 7,4% |

Gestur `point` di HaGRID adalah **menunjuk ke arah kamera**. Akibatnya
telunjuk terproyeksi pendek dan 48,6% sampel justru terlihat seperti kepalan
di ruang 2D — berbahaya karena bisa tertukar dengan `kepalan`.
Kelas `one` (telunjuk berdiri, jari lain terlipat) adalah padanan 2D yang
benar untuk gestur `telunjuk` di SDD ("hanya telunjuk yang terentang").

## Normalisasi (Bab 4 SDD)

Untuk setiap dari 21 landmark:

```
x' = (x - x_wrist) / dist
y' = (y - y_wrist) / dist
z' = 0
dist = jarak 2D titik 0 (wrist) ke titik 9 (pangkal jari tengah)
```

- Koordinat HaGRID (0..1) dikonversi dulu ke piksel: `x*1920`, `y*1080`.
  Ini penting: x dan y dinormalisasi terhadap lebar/tinggi yang berbeda,
  jadi tanpa konversi bentuk tangan ikut gepeng sesuai aspect ratio.
- `dist` dihitung **2D**, bukan 3D, supaya skala training dan live sama.
- `z` selalu 0 karena HaGRID hanya menyediakan 2D. Model **tidak boleh**
  diberi z asli MediaPipe saat live (input akan beda dari training).
- Output: 63 angka, urutan `x0,y0,z0, x1,y1,z1, ..., x20,y20,z20`.
- Implementasi: `normalization.py` (dipakai dataset, training, dan P1).

## Filter kualitas

| Filter | Nilai | Tujuan |
|---|---|---|
| Jumlah landmark | tepat 21 | anotasi lengkap |
| Rentang koordinat | −0,1 … 1,1 | buang landmark di luar frame |
| `dist` 0→9 | ≥ 40 px | buang tangan terlalu kecil (landmark berisik) |
| Radius ternormalisasi | ≤ 5,0 | buang bentuk tidak wajar (anotasi rusak) |

Tanpa filter `dist` yang benar, 44% kelas `point` lolos dengan bentuk
meledak (radius sampai 23×). Setelah filter + ganti ke `one`, sisa bentuk
tidak wajar hanya 7 dari 64 ribu baris.

## Pembagian data

Memakai pembagian resmi HaGRID yang **dipisah per subjek** (`user_id`),
bukan split acak. Ini mencegah kebocoran orang yang sama ke data uji.

- Tidak ada `user_id` yang muncul di train dan test (0 overlap).
- Train dipakai untuk training, val untuk pemantauan, test untuk evaluasi akhir.
- Maksimum 4.000 sampel per kelas per split (agar file wajar); val lebih
  sedikit karena isi file val HaGRID memang lebih kecil.

| Label | train | val | test | total |
|---|---:|---:|---:|---:|
| telapak_terbuka | 4.000 | 2.745 | 4.000 | 10.745 |
| kepalan | 4.000 | 2.625 | 4.000 | 10.625 |
| telunjuk | 4.000 | 2.617 | 4.000 | 10.617 |
| dua_jari | 4.000 | 2.793 | 4.000 | 10.793 |
| jempol | 4.000 | 2.900 | 4.000 | 10.900 |
| ok | 4.000 | 2.749 | 4.000 | 10.749 |
| **total** | **24.000** | **16.429** | **24.000** | **64.429** |

Semua jauh di atas syarat SDD (≥200 per gestur, ≥3 orang); jumlah subjek
unik: 8.110 (train), 1.270 (val), 1.306 (test).

## File

| File | Isi |
|---|---|
| `landmarks.csv` | 63 kolom fitur + `label`, `split`, `user_id`, `image_id` |
| `dataset_meta.json` | sumber, mapping, filter, jumlah, statistik |
| `analysis/dataset_report.json` | QA: NaN, z, wrist, user overlap, statistik fitur |
| `analysis/landmark_samples.png` | cek visual 21 landmark per kelas |
| `prepare_dataset.py` | pembentuk dataset (bisa dijalankan ulang) |
| `normalization.py` | fungsi normalisasi bersama |

## Regenerasi

```powershell
curl.exe -L -o hagrid_annotations\annotations.zip "<URL di atas>"
py -3.11 prepare_dataset.py
py -3.11 analyze_dataset.py
py -3.11 visualize_samples.py
```

## Keterbatasan (jujur untuk laporan)

- Ini **bukan** dataset rekaman sendiri seperti diminta SDD (30–60 cm,
  terang/redup, ≥3 orang). HaGRID adalah proksi publik berskala besar;
  variasi jarak, cahaya, dan orang jauh lebih banyak, tetapi bukan kondisi
  webcam kelas secara spesifik. Ini dicatat sebagai deviasi.
- Hanya 2D; kedalaman (`z`) tidak tersedia.
- Gestur `jempol` dan `kepalan` paling berpotensi tertukar di 2D karena
  bentuk tinju keduanya mirip; lihat confusion matrix di `evaluation.json`.
- Data rekaman sendiri tetap bisa ditambahkan lewat `record_data.py`
  (format CSV sama) lalu latih ulang.
