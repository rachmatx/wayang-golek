# Catatan Deviasi — P2 → P1

Status: **Tahap 1–3 selesai**. File yang dikirim:

| File | Isi |
|---|---|
| `wayang.svg` | Dua wayang dalam satu kanvas (kiri + kanan), semua gambar PNG inline base64. **Ini yang dipakai aplikasi.** |
| `wayang_kiri.svg` | Satu wayang (kiri), ID persis SDD. Untuk preview/uji terpisah. |
| `wayang_kanan.svg` | Satu wayang (kanan), ID persis SDD. |
| `pivots.json` | Koordinat pivot tiap sendi + catatan konvensi rotasi. |
| `model.pkl` | Model MLP terlatih (pipeline scaler + MLP 128-64). |
| `labels.json` | 6 label, urutan sama dengan kelas model. |
| `normalization.py` | Fungsi normalisasi Bab 4 (63 angka). |
| `inference.py` | Pembungkus model → JSON kontrak. |
| `landmarks.csv` | Dataset 64.429 baris (bahan laporan Bab 4). |
| `evaluation.json` | Accuracy, precision/recall/F1, confusion matrix. |
| `images/` | 10 layer PNG sumber + backup manual. **Hanya ada di folder proyek P2**, tidak dikirim karena SVG sudah self-contained. |

Tidak ada file eksternal yang perlu di-load: PNG sudah di dalam SVG.

---

## 1. ID layer

Sesuai SDD Bab 5, untuk wayang pertama:

```
#grup-wayang
  #badan
  #lengan-atas-kiri   →  #lengan-bawah-kiri   (nested)
  #lengan-atas-kanan  →  #lengan-bawah-kanan  (nested)
```

Wayang kedua di `wayang.svg` memakai sufiks **`-2`** supaya ID tetap unik:

```
#grup-wayang-2
  #badan-2
  #lengan-atas-kiri-2   →  #lengan-bawah-kiri-2
  #lengan-atas-kanan-2  →  #lengan-bawah-kanan-2
```

Di `wayang_kanan.svg` (file terpisah) ID-nya **tanpa** sufiks, sama seperti wayang pertama.

### Deviasi yang harus diketahui P1

| ID SDD | Status | Alasan | Saran animasi |
|---|---|---|---|
| `#kepala` | **Tidak ada** | Di gambar sumber kepala menyatu dengan badan (tidak bisa dipisah tanpa merusak detail). | Gestur `jempol` (menunduk): putar `#grup-wayang` / `#grup-wayang-2` ±6–10° dengan pivot di kaki. |
| `#tongkat` | **Tidak ada** | Wayang tidak memakai tongkat terpisah; batang kendali (cepala) menempel di tangan dan sudah ikut di layer `lengan-bawah-*`. | Gestur `dua_jari` (angkat tongkat): angkat `#lengan-bawah-*`; batang otomatis ikut terangkat. |

Kalau P1 butuh ID lain, kabari dulu — jangan rename sendiri (Bab 8).

---

## 2. Cara memakai pivot

Pivot sudah tertanam di SVG sebagai `data-pivot-x` / `data-pivot-y` **dan** di `transform="rotate(0 cx cy)"`:

```js
function putar(id, deg) {
  const el = document.getElementById(id);
  el.setAttribute('transform',
    `rotate(${deg} ${el.dataset.pivotX} ${el.dataset.pivotY})`);
}

putar('lengan-atas-kiri', -15);   // bahu
putar('lengan-bawah-kiri', 25);   // siku (relatif terhadap lengan atas)
```

- **Nested**: `#lengan-bawah-*` ada di dalam `#lengan-atas-*`. Jadi kalau bahu diputar,
  siku otomatis ikut pindah — P1 tidak perlu menghitung posisi siku.
- `deg` **positif = searah jarum jam** (sumbu y ke bawah).
- Arah yang sudah diuji (berlaku untuk kedua wayang):

| Sendi | Angkat lengan | Lipat siku ke arah badan | Rentang aman |
|---|---|---|---|
| `lengan-atas-kiri` / `-2` | **positif** | — | −25° … +25° |
| `lengan-atas-kanan` / `-2` | **negatif** | — | −25° … +25° |
| `lengan-bawah-kiri` / `-2` | — | **negatif** | −40° … +15° |
| `lengan-bawah-kanan` / `-2` | — | **positif** | −15° … +40° |

Contoh pose "kedua lengan terangkat" (gestur `telapak_terbuka`):

```js
putar('lengan-atas-kiri', 18);   // kiri naik
putar('lengan-atas-kanan', -18); // kanan naik
```

`pivots.json` memuat angka yang sama. Untuk `wayang.svg`, pivot wayang kanan
sudah termasuk offset kanvas (+484 px). Untuk `wayang_kanan.svg`, pakai angka
di bagian `wayang_kanan.svg` pada file itu.

---

## 3. Catatan teknis rigging (bahan laporan P2)

Manual rigging di GIMP menghasilkan 5 layer per wayang, tapi ada dua masalah
yang diperbaiki otomatis (`fix_layers.py`, backup di `images/_manual_backup/`):

1. **Wayang kiri, lengan kiri**: layer lengan atas terpotong di tengah humerus,
   separuh proksimalnya masih menempel di layer badan. Bagian itu dipindah dari
   gambar asli ke layer lengan, sehingga pivot bahu (210,164) benar-benar di sendi.
2. **Wayang kanan, lengan kanan**: lengan atas masih utuh di layer badan,
   sedangkan dua layer "atas/bawah" sebenarnya potongan forearm. Dibuat layer
   lengan atas baru, dua potongan forearm digabung jadi satu.
3. Fragmen kecil sisa potongan dibersihkan dari layer badan; di titik bahu
   disisakan "bola bahu" statis agar tidak ada lubang saat lengan diputar.

Verifikasi:

- Render SVG keadaan diam **identik piksel** dengan composite layer (selisih ≤ 1/255).
- Uji rotasi bahu ±18–22° dan siku ±25–35°: tidak ada bagian yang lepas/tertinggal
  (`analysis/rigtest_kiri.png`, `analysis/rigtest_kanan.png`, `analysis/svg_test_render.png`).
- IoU alpha terhadap gambar asli: kiri 0,952 ; kanan 0,939 (selisih berasal dari
  potongan manual, bukan dari perbaikan).

---

## 4. Yang belum ada

- `gesture_map.json` milik P1.
- Skrip animasi: itu bagian P1; contoh `putar()` di atas bisa langsung dipakai.
- Uji akurasi di webcam asli (model diuji pada test HaGRID, bukan kamera).

---

## 5. Deviasi dataset & model (Tahap 2–3)

| Deviasi | Alasan | Dampak ke P1 |
|---|---|---|
| Dataset memakai **HaGRID v2** (anotasi landmark), bukan rekaman sendiri | 1,5 TB gambar tidak diperlukan; anotasi sudah berisi 21 landmark. Variasi orang/cahaya/jarak jauh lebih banyak. | Tidak ada perubahan API. Catat di laporan sebagai deviasi. |
| Gestur `telunjuk` memakai kelas HaGRID **`one`**, bukan `point` | `point` = menunjuk ke kamera; di 2D hanya 7,4% sampel benar-benar satu jari (48,6% tampak seperti kepalan). `one` = 96,4% satu jari. | Tidak ada; label tetap `telunjuk`. |
| Landmark hanya 2D → **z = 0** | HaGRID tidak menyediakan kedalaman. | **Jangan kirim z asli MediaPipe** ke model. Pakai `normalization.py` (z otomatis 0). |
| Akurasi test 99,74% diukur pada landmark HaGRID | Landmark HaGRID juga dibuat MediaPipe, kualitas anotasi tinggi. | Akurasi webcam live bisa lebih rendah; perlu uji kamera dan smoothing. |

Detail dataset: `DATASET.md` dan `dataset_meta.json`. Detail model: `MODEL.md`
dan `evaluation.json`.
