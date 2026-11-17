# Wayang Kulit Jawa Timuran

Panggung budaya interaktif berbasis webcam dan gestur tangan. Kenali tokoh, cengkok, musik, serta tradisi masyarakat Jawa Timuran, lalu mainkan wayang sendiri atau berduet.

Pengembangan versi 0.3 berada di branch `feat/wayang-kulit-jatim`. [Rencana](docs/superpowers/plans/2026-11-18-wayang-kulit-jatim.md) · [Riset](docs/research/2026-11-18-wayang-kulit-jawa-timuran.md).

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
- Font dan aset lokal, tata letak ponsel, reduced motion, layar penuh, pengaturan suara, dan musik latar opsional.

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
