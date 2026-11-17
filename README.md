# Wayang Kulit Jawa Timuran

Panggung budaya interaktif berbasis webcam dan gestur tangan. Kenali tokoh, cengkok, musik, serta tradisi masyarakat Jawa Timuran, lalu mainkan wayang sendiri atau berduet.

Pengembangan versi 0.4.0 berada di branch `feat/jatim-stage-motion-v03`. [Rencana](docs/superpowers/plans/2026-11-18-wayang-kulit-jatim.md) · [Riset](docs/research/2026-11-18-wayang-kulit-jawa-timuran.md).

## Fitur

- Dua latar ilustratif: Pendopo Senja dan Rimba Malam, dengan bingkai kayu, kelir bercahaya, dan lanskap berlapis. Pilihan suasana tersimpan di perangkat.
- Transisi pose berbasis spring yang konsisten terhadap frame rate; bahu, siku, dan badan bergerak berlapis, dengan ayunan susulan ketika berpindah.
- Telunjuk menggerakkan wayang sepanjang area aman panggung: posisi tangan 20–80% sudah mencapai rentang penuh. Contoh panggung desktop 944 px: sekitar ±277 px, menyesuaikan ukuran layar dan karakter.
- Tiga karakter berlapis: Gatotkaca, Semar, dan Bagong; satu atau dua pemain dengan pilihan tokoh masing-masing.
- Enam gestur tangan melalui MediaPipe dan model MLP; sumber kamera dapat diganti dari Pengaturan.
- Mode latihan dengan tombol, keyboard, dan slider posisi tangan untuk demo tanpa kamera.
- Panduan enam gestur dengan ikon duotone besar, keterangan aksi, dan indikator gestur aktif.
- Dua belas fakta budaya dengan kategori, konteks daerah, dan sumber penelitian. Konten tersedia lokal.
- Panel budaya menahan cue suara dan pintasan gestur saat dibaca; Escape menutup panel dan mengembalikan fokus.
- Tombol Audio dekat panggung: dialog, musik latar, dan SFX memiliki toggle serta volume terpisah; tersedia volume master dan Bisukan semua. Pilihan tersimpan di perangkat.
- Untuk pengunjung baru, BGM mulai pelan setelah panggung dibuka. Pilihan musik mati dari sesi sebelumnya tetap dihormati.
- Font dan aset lokal, tata letak ponsel, reduced motion, layar penuh, serta panel audio berbentuk bottom sheet di ponsel.

![Panggung duet](docs/images/jatim-v03-rimba-duet.jpg)

## Menjalankan di Windows

Pasang Python 3.10–3.12 terlebih dahulu. Dari PowerShell di folder proyek:

```powershell
.\setup.bat
.\run.bat
```

`setup.bat` membuat virtual environment dan memasang `requirements.txt`. Untuk pemakaian berikutnya cukup `run.bat`.

Buka **http://127.0.0.1:8000**. Kamera diakses oleh backend Python, bukan browser. Menjalankan frontend lewat `file://` tidak didukung.

## Linux/macOS atau setup manual

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m backend.app
```

Di Windows, aktivasi manual menggunakan `.venv\Scripts\activate`. Internet diperlukan saat pemasangan paket; setelah dependensi lengkap, panggung dan konten lokal tidak memerlukan layanan eksternal. Membuka tautan sumber tetap memerlukan internet. Perangkat harus memiliki kamera dan memberikan izin yang diperlukan untuk deteksi nyata.

## Kendali

| Gestur | Tombol latihan | Perilaku |
| --- | --- | --- |
| Telapak terbuka | `1` | Mengangkat kedua lengan |
| Kepalan | `2` | Kembali diam |
| Telunjuk | `3` | Bergeser mengikuti posisi tangan |
| Dua jari | `4` | Mengangkat lengan bawah |
| Jempol | `5` | Membungkuk lalu kembali |
| OK | `6` | Berbalik arah |
| Netral | `0` | Kembali netral |

Gunakan pilihan **Pendopo Senja / Rimba Malam** di bawah panggung. Di mode latihan, geser slider **Geser wayang** untuk menguji telunjuk secara manual, atau tekan `3` untuk gerakan demo otomatis. Dalam duet, kedua tokoh berbagi panggung dan dapat saling melintas.

`D` membuka/menutup latihan, `P` memilih pemain latihan dalam mode Duet, `?` membuka panduan, `V` mengatur dialog, dan `K` mengatur kamera. Saat panel bacaan terbuka, pintasan gestur dinonaktifkan agar tidak mengganggu bacaan. Pilih **Coba tanpa kamera** untuk langsung membuka panggung dan latihan.

## Isi budaya dan aset

Cakupan materi adalah wayang kulit purwa gaya Jawa Timuran/Jekdong. Keterangan subgaya, naskah, dan dalang disertakan ketika suatu fakta hanya berlaku pada konteks tersebut. Tokoh tidak diklaim eksklusif milik satu daerah.

Ilustrasi dibuat baru sebagai interpretasi digital, dengan badan dan empat bagian lengan pada sprite sheet transparan. SVG runtime menyematkan raster WebP sekali dan memakai crop/pivot SVG untuk animasi; ini **bukan vektor murni**. Ilustrasi belum ditinjau praktisi pedalangan.

- [Kredit aset dan batas representasi](frontend/assets/jatim/ASSET_CREDITS.md)
- [Prompt, sumber produksi, dan metadata](frontend/assets/jatim/manifest.json)
- [Contact sheet pose](frontend/assets/jatim/rig-contact-sheet.webp)
- [Kredit audio](frontend/assets/audio/AUDIO_CREDITS.md)
- [Sumber fakta](frontend/data/culture.json)

Dialog Semar dan Bagong adalah naskah baru aplikasi. Suara memakai TTS perangkat; kualitas dan ketersediaan Bahasa Indonesia bergantung pada browser. Musik lama berasal dari beberapa tradisi dan default mati; keterangannya tersedia pada Pengaturan. Efek gerak dan cue audio adalah interpretasi interaksi digital.

## Struktur

```text
backend/                 FastAPI, kamera, MediaPipe, model, pipeline, WebSocket
frontend/
  index.html             antarmuka panggung dan panel
  css/jawatimuran.css     tampilan Jawa Timuran di atas style/teater lama
  js/app.js              pemain, kamera, prediksi, pilihan karakter
  js/animation.js        rig, pivot, arah hadap, pergerakan
  js/culture-core.js     validasi konten dan pemilihan fakta tanpa pengulangan
  js/culture.js          kartu fakta, kategori, sumber, dan panel budaya
  js/theater*.js         babak pertunjukan, fokus panel, cue dan audio
  data/                  registry karakter dan fakta bersumber
  assets/jatim/          master, runtime, rig, kredit, dan metadata aset baru
  assets/fonts/          font lokal dan lisensi
  tools/                 pemeriksaan rig, perakitan SVG, dan tes frontend
shared/gesture_map.json   enam kelas gestur dan label aksi
models/                  MLP utama dan RF dalam pengaturan teknis
handoff_p2/              paket penelitian dan dataset landmark
```

Karakter dan berkas golek lama tetap menjadi arsip teknis; pilihan panggung versi ini menggunakan registry Jawa Timuran. Kontrak WebSocket `hands[]`, normalisasi 63 fitur, dan kelas model dipertahankan.

## Verifikasi

```bash
node --test frontend/tools/test_*.mjs
python frontend/tools/check_wayang_rig.py
python backend/tools/test_logika.py
python backend/tools/test_model_service.py
python backend/tools/test_kamera.py
python backend/tools/test_dua_tangan.py
python backend/tools/test_p2_model.py
```

Uji model menggunakan sampel dataset dan berbeda dari pengujian webcam langsung. Kamera nyata, pencahayaan ruang presentasi, serta suara Indonesia perlu diperiksa pada perangkat demo.

Untuk QA responsif lokal tambahan, `npm run dev` memakai Python dan dependensi yang sama; Node tidak diperlukan untuk menjalankan backend biasa. Fixture pada `/__qa/responsive-preview.html` hanya tersedia lewat entry point preview, bukan server aplikasi normal.

## Upgrade v0.3

Lihat [catatan riset dan keputusan gerak](docs/research/2026-11-18-upgrade-v03.md) dan [hasil verifikasi](docs/verification/2026-11-18-jatim-v03.json).

## Tahap 1 — audio v0.3.1

Tekan **Audio** di toolbar panggung. Matikan **Dialog wayang** untuk menikmati musik dan SFX sambil tetap membaca teks dialog. Toggle ketiga kanal saling independen; **Bisukan semua** mempertahankan pilihan masing-masing kanal ketika suara diaktifkan kembali. Pengaturan teknis juga mempunyai tautan ke panel Audio yang sama.

Volume master sekarang ikut mengatur rekaman dialog dan TTS browser. Pada beberapa browser, perubahan volume TTS saat sedang berbicara menghentikan kalimat tersebut; kalimat berikutnya memakai level baru. Rekaman dialog menyesuaikan volume saat itu juga.

Musik tetap dapat didengar selama panel Audio terbuka. Panel bacaan budaya masih menjeda panggung/audio. Panel audio menunjukkan status musik dan pesan jika berkas gagal dimuat. Sumber audio lama tetap digunakan dengan keterangan lintas tradisi; tahap ini tidak menambahkan rekaman baru atau klaim iringan Jekdong autentik.

[Verifikasi tahap 1](docs/verification/2026-11-18-audio-stage1.json)

## Tahap 2 — hierarki studio v0.3.2

Panggung kini mempunyai toolbar berisi **Solo/Duet**, **Audio**, **Latihan**, dan **Perbesar**. Latihan tampil langsung di bawah panggung, diikuti pilihan suasana dan tokoh. Tombol Latihan membuka panggung tanpa kamera dan menyinkronkan statusnya dengan pintasan `D` serta kontrol lain.

Ruang dalang dibagi menjadi kartu kamera dan panduan gestur yang dapat dilipat. Tombol kamera pada kartu memakai aksi yang sama dengan tombol kamera lama dan mencerminkan status aktivasi dari backend. Panduan mulai tertutup pada ponsel/tablet agar panggung lebih dekat ke atas halaman.

Pada layar kecil, toolbar menggunakan dua baris, tokoh duet ditumpuk per pemain, dan kamera/panduan mengikuti pilihan tokoh. Angka keyakinan, FPS, serta model tetap tersedia di Pengaturan; strip panggung berfokus pada gestur pemain. Mode Perbesar menyembunyikan panel pendamping, pilihan tokoh/suasana, dan fakta sambil mempertahankan kontrol bermain serta Audio. Jika fullscreen ditolak browser, mode fokus pada halaman tetap tersedia.

[Verifikasi tahap 2](docs/verification/2026-11-18-layout-stage2.json).


## Tahap 3–4 — fakta otomatis dan kendali v0.4.0

**Tahukah kamu?** berganti setiap 30 detik selama kartu terlihat. Gunakan tombol sebelumnya/berikutnya atau **Jeda / Putar**; pilihan jeda tersimpan di browser. Timer berhenti ketika kartu di luar layar, tab tidak aktif, panel modal terbuka, atau pointer/fokus keyboard sedang berada di kartu. Putar memulai waktu baca baru. Preferensi reduced motion memulai dalam mode manual kecuali pengguna sudah memilih otomatis.

Tinggi teks disiapkan untuk seluruh fakta agar pergantian tidak menggeser layout. Riwayat navigasi mempertahankan bacaan sebelumnya; fakta baru mengikuti siklus tanpa pengulangan. Pergantian otomatis tidak mengumumkan ulang teks melalui live region pembaca layar, sedangkan navigasi manual memakai pengumuman sopan.

Buka **Ruang dalang → Sesuaikan gerak**. Pilih kepekaan **Halus**, **Seimbang**, atau **Responsif**. Untuk kalibrasi, tunjukkan telunjuk di posisi tangan yang nyaman, lalu tekan **Kalibrasi titik tengah**. Dalam duet, pilih P1 atau P2 sebelum kalibrasi. Masing-masing pemain mempunyai titik tengah sendiri; kepekaan berlaku bersama. Pengaturan tersimpan lokal dan **Reset kendali** mengembalikan keduanya ke awal.

Kalibrasi juga dapat dicoba tanpa kamera: aktifkan **Latihan**, pilih pemain, lalu geser slider. Input kamera yang tidak terbaca selama lebih dari 1,5 detik tidak dapat dipakai untuk kalibrasi. Area tengah mempunyai toleransi kecil terhadap gerakan ringan, dan batas gerak panggung tetap dijaga agar wayang tidak keluar layar.

[Verifikasi tahap 3–4](docs/verification/2026-11-18-auto-controls.json). Kamera fisik dan kenyamanan gestur tetap perlu diuji pada perangkat presentasi.
