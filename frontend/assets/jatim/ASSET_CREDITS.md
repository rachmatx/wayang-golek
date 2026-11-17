# Aset ilustrasi Jawa Timuran

Paket ini dibuat pada 18 November 2026 untuk aplikasi wayang kulit interaktif.
Semua gambar adalah **ilustrasi interpretatif hasil generasi gambar**, bukan foto
benda koleksi, salinan karya penyungging tertentu, atau hasil validasi praktisi.

## Isi dan sumber produksi

| Berkas | Keterangan |
| --- | --- |
| `gatotkaca-sheet.png` | Master asli: badan tanpa lengan dan empat potongan lengan terpisah |
| `semar-sheet.png` | Master asli figur Semar dan bagian lengan |
| `bagong-sheet.png` | Master asli figur Bagong dan bagian lengan |
| `*-sheet.webp` | Encoding runtime dengan alpha, dibuat dari master tanpa mengubah geometri ilustrasi |
| `wayang-*.svg` | Rig dengan satu embedded WebP, crop SVG, pivot bahu/siku dan hierarki lengan |
| `gunungan.png`, `gunungan.webp` | Master dan encoding ilustrasi gunungan untuk pembuka/transisi |
| `rig-specs.json` | Kotak crop, skala, titik sendi, titik kaki dan urutan lapisan untuk regenerasi rig |
| `manifest.json` | Prompt final, rujukan, identitas aset dan batas klaim gaya |
| `rig-contact-sheet.webp` | Pemeriksaan visual: baris Gatotkaca/Semar/Bagong; kolom netral/telapak/dua jari |

Mode pembuatan: built-in image generation. Master PNG disimpan tanpa pengeditan
pixel. Versi WebP di-encode dengan ImageMagick quality 88 untuk pemuatan aplikasi.
`frontend/tools/build_jatim_rigs.py` hanya merakit XML SVG dan tidak menggambar
ulang atau memotong pixel raster. Batang kendali tangan sederhana ditambahkan
sebagai garis SVG dan menjadi anak grup lengan bawah, sehingga ikut bergerak.

## Rujukan bentuk

- Ayuswantana, Atmaji, dan Setiawan (2024),
  [kajian rupa Gathutkaca Krodha pada Jekdong](https://publikasi.dinus.ac.id/andharupa/article/download/8040/4421/32800).
  Deskripsi anggota badan dan busana menjadi rujukan interpretasi Gatotkaca.
  Screenshot PDF dialihkan ke login saat diperiksa; foto dalam artikel tidak
  disalin ke paket ini. Aset bukan rekonstruksi spesimen penelitian.
- Ayuswantana, Atmaji, Nisa, dan Arifianto (2024),
  [kajian rupa Semar pada Jekdong](https://e-journal.umaha.ac.id/deskovi/article/download/16334/1518).
  Deskripsi terindeks dan teks yang dipublikasikan penulis menjadi rujukan
  umum figur membulat, wajah putih Semar, wajah merah Bagong, dan motif kawung.
  Unduhan primer tidak terbuka saat produksi; bentuk spesifik per periode
  tidak diklaim telah dicocokkan dengan foto objek.

Istilah Jekdong tidak menjadikan tiap detail gambar otomatis autentik. Perbedaan
wanda, cengkok, periode, dan pembuat tetap memerlukan pemeriksaan visual dengan
praktisi atau koleksi rujukan. Ilustrasi gunungan dipakai sebagai interpretasi
dekoratif; tidak diberi klaim makna simbolis rinci atau gagrak tertentu.

## Pemeriksaan teknis

Rig mengikuti kontrak badan dan empat lengan dengan sendi bahu → siku, nama ID
yang stabil, dan pivot dalam viewBox 444×562. Semua gambar menghadap kanan pada
arah dasar. Titik kaki tersedia sebagai `data-foot-x/y`. Bagian lengan bersumber
dari sprite terpisah, sehingga animasi tidak bergantung pada potongan tubuh yang
sebelumnya menyatu. Thumbnail dapat memakai berkas rig yang sama.

Checker memeriksa nesting, pivot, ID unik dan referensi crop yang terhubung.
Render netral, telapak, dan dua jari diperiksa secara visual. Renderer Inkscape
lokal memakai PNG master identik karena build tersebut tidak mendekode WebP
embedded; runtime WebP tetap memerlukan pemeriksaan browser pada integrasi.
Pengujian kamera
dan pengakuan validasi budaya tidak termasuk hasil pemeriksaan ini.
