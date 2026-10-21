# MODEL — Klasifikasi Gestur Tangan

Model menerima **63 angka** hasil `normalization.py` dan mengeluarkan salah
satu dari 6 label SDD. Model dilatih dari `landmarks.csv` (HaGRID v2).

## Ringkasan hasil

| Model | Val acc | Test acc | F1-macro (test) | Waktu latih | Prediksi |
|---|---:|---:|---:|---:|---:|
| **MLP 128-64 (utama)** | 0,9971 | **0,9974** | 0,9974 | 16,0 s | 0,0018 ms/sampel |
| Random Forest 300 pohon | 0,9965 | 0,9964 | 0,9964 | 9,5 s | 0,0077 ms/sampel |

Test = 24.000 sampel (4.000/kelas), subjek terpisah dari training.

### Per kelas (MLP, test)

| Label | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| telapak_terbuka | 0,999 | 0,999 | 0,999 | 4.000 |
| kepalan | 0,994 | 0,999 | 0,996 | 4.000 |
| telunjuk | 0,997 | 0,992 | 0,995 | 4.000 |
| dua_jari | 0,997 | 0,996 | 0,996 | 4.000 |
| jempol | 0,998 | 1,000 | 0,999 | 4.000 |
| ok | 0,999 | 0,999 | 0,999 | 4.000 |

Kesalahan tersisa hampir semua `telunjuk` ↔ `kepalan` (19 dari 24.000),
wajar karena telunjuk yang tertutup sebagian bisa tampak seperti kepalan.

> **Penting untuk laporan:** akurasi ~99,7% ini diukur pada landmark HaGRID
> yang juga dihasilkan MediaPipe (kualitas anotasi tinggi, pose jelas).
> Akurasi webcam live bisa lebih rendah karena noise tracking, blur, dan
> pencahayaan. Uji webcam tetap wajib (`predict_webcam.py`).

## Arsitektur

- Input: 63 fitur (21 landmark × x,y,z; z selalu 0).
- `StandardScaler` → `MLPClassifier(hidden_layer_sizes=(128, 64), relu, adam)`.
- Regularisasi L2 `alpha=1e-4`, batch 256, early stopping (10% train,
  `n_iter_no_change=20`), berhenti di iterasi 50.
- Augmentasi cermin (`x → −x`) pada training: 24.000 → 48.000 baris,
  agar model tidak bergantung tangan kiri/kanan.
- Random Forest 300 pohon sebagai pembanding (bukan model utama).

Semua hyperparameter tersimpan di `evaluation.json`.

## File

| File | Isi | Ukuran |
|---|---|---:|
| `models/model.pkl` | pipeline scaler + MLP (utama) | 0,4 MB |
| `models/model_rf.pkl` | pipeline scaler + Random Forest | 24,8 MB |
| `models/labels.json` | urutan label + urutan fitur | <1 KB |
| `evaluation.json` | metrik, confusion matrix, parameter, waktu | — |
| `analysis/confusion_mlp.png` | confusion matrix MLP | — |
| `analysis/confusion_rf.png` | confusion matrix RF | — |

`model.pkl` mengeluarkan **indeks 0..5** (bukan string); urutannya ada di
`labels.json`. Cara termudah: pakai `inference.py` yang sudah memetakan
indeks ke nama dan membentuk JSON kontrak.

## Cara pakai (P1)

```python
from inference import GesturePredictor

predictor = GesturePredictor()      # load model.pkl + labels.json

# landmarks MediaPipe (0..1) + ukuran frame
hasil = predictor.predict(
    [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark],
    image_size=(frame_w, frame_h),
)
# {"gesture": "...", "confidence": 0.99, "probabilities": {...}}

payload = predictor.predict_json(
    [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark],
    image_size=(frame_w, frame_h),
)
# {"gesture": "...", "confidence": ..., "wrist_x": ..., "wrist_y": ..., "state": "ok"}
```

Kirim `payload` ke `ws://localhost:8000/ws/predict`.

**Jangan** memberi `z` asli MediaPipe tanpa retraining: dataset 2D, jadi
`normalization.py` mengunci z=0. Jika `use_z=True`, model akan menerima
input yang tidak pernah dilihat saat training.

## Lingkungan

- Python 3.11
- scikit-learn 1.8.0, joblib 1.5.3, numpy 2.4.6
- mediapipe 0.10.35 (Tasks API), protobuf 7.36.2
- Simpan versi ini saat deploy agar `model.pkl` kompatibel.

> MediaPipe 0.10.35 ikut meng-import TensorFlow bila terpasang (hanya untuk
> docstring), jadi startup pertama bisa 10–20 detik. Ini normal dan tidak
> memengaruhi kecepatan inferensi (model tetap <1 ms/sampel).

## Troubleshooting

- `ImportError: cannot import name 'runtime_version' from 'google.protobuf'`
  → konflik MediaPipe lama (`protobuf<5`) dengan TensorFlow 2.21
  (`protobuf>=6.31`). Solusi yang dipakai: mediapipe 0.10.35 + protobuf 6.31+.
- `py -3.11 predict_webcam.py` tidak menampilkan jendela → tunggu 10–20 detik
  (import TensorFlow), pastikan kamera tidak dipakai aplikasi lain, dan izinkan
  akses kamera di Windows.

## Latih ulang

```powershell
py -3.11 prepare_dataset.py      # opsional, jika dataset berubah
py -3.11 train_model.py          # tulis model.pkl, evaluation.json
py -3.11 train_model.py --no-mirror   # tanpa augmentasi cermin
```

Data rekaman sendiri bisa ditambahkan lewat `record_data.py` (format CSV
sama), lalu gabungkan ke `landmarks.csv` dan latih ulang.
