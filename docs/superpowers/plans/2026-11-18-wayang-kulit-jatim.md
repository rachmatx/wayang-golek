# Rencana Pengembangan Wayang Kulit Jawa Timuran

Tanggal: 18 November 2026 (Asia/Jakarta)
Branch: `feat/wayang-kulit-jatim`
Baseline: `0114a3f` pada `main`
Status: implementasi versi 0.2 tersedia; lihat [hasil verifikasi](../../verification/2026-11-18-jatim.json). Uji webcam dan performa perangkat presentasi masih perlu dilakukan.

## 1. Sasaran produk

Aplikasi mendalang dengan gestur tangan yang terasa seperti pameran budaya interaktif: panggung yang menarik, karakter yang jelas rujukannya, kontrol yang mudah dipahami, dan fakta budaya yang dapat ditelusuri sumbernya.

Nama kerja di antarmuka: **Wayang Kulit Jawa Timuran**. Subjudul: **Belajar budaya, mendalang dengan gerak tangan**. Nama kerja ini bukan pengganti judul akademik lengkap kelompok.

Fokus operasional: wayang kulit purwa gaya Jawa Timuran, dengan istilah Jekdong/Cekdong dijelaskan dalam konten. Trowulan dipakai sebagai salah satu rujukan awal, bukan label autentisitas bagi semua aset. Fakta mengenai Malangan atau Porongan diberi konteks masing-masing. Dasar penetapan ruang lingkup ada di [catatan riset](../../research/2026-11-18-wayang-kulit-jawa-timuran.md).

## 2. Fondasi teknis dan batas perubahan

- Pertahankan FastAPI, WebSocket, JavaScript/CSS, dan SVG; belum ada kebutuhan mengganti framework.
- Pertahankan enam kelas gestur, normalisasi 63 fitur, dan kontrak pesan `hands[]`. Mengganti karakter tidak memerlukan pelatihan ulang model gestur.
- MLP tetap model utama. RF yang ada di repo ditempatkan dalam pengaturan teknis; penyajiannya pada laporan diselaraskan dengan ruang lingkup penelitian kelompok.
- Satu dan dua pemain, pengikatan tangan ke slot, pergantian kamera, sambung ulang, mode latihan tanpa kamera, dan pengaturan suara tetap menjadi skenario wajib.
- Skor, akun, leaderboard, cerita bercabang, dan karakter 3D tidak masuk rilis pertama.
- Spesifikasi Oktober 2026 menjadi catatan historis. Batasan lamanya mengenai larangan aset/karakter baru tidak berlaku untuk pengembangan yang diminta sekarang.

## 3. Pengalaman pengguna dan arah visual

| Bagian | Rancangan |
| --- | --- |
| Pembuka | Judul budaya, satu karakter/gunungan sebagai fokus, tombol **Mulai mendalang**, **Coba tanpa kamera**, dan **Jelajahi budaya** |
| Panggung | Kelir krem hangat dalam bingkai gelap; aksen kuningan dan merah bata secukupnya; cahaya hangat serta bayangan yang mengikuti wayang |
| Karakter | Pilihan bergambar, nama tokoh, deskripsi pendek, dan rujukan gaya; pergantian pemain 1/2 terlihat jelas |
| Kendali | Preview kamera dengan status yang jujur; panduan enam gestur dekat area kendali; informasi teknis tersedia di laci |
| Edukasi | Kartu **Tahukah Kamu?** di luar area gerak wayang dan panel **Jelajahi budaya** untuk membaca lebih lanjut |
| Responsif | Desktop menjadi target utama demo; tablet/ponsel memakai susunan bertumpuk tanpa memaksa orientasi layar |

Palet awal: latar `#151310`, permukaan `#23201B`, kelir `#F0E3C8`, kuningan `#BC955D`, aksen merah bata `#8F4436`. Semua warna adalah usulan desain; kontras teks diuji pada hasil render. Pasangan font dibatasi pada satu display dan satu sans, disimpan lokal beserta lisensinya agar demo tidak bergantung pada Google Fonts.

Panggung mendapat ruang terbesar. Ornamen menjadi bingkai dan penanda bagian, dengan detail yang tidak bersaing dengan karakter. Efek pencahayaan dan transisi merupakan interpretasi digital, bukan klaim rekonstruksi lengkap pertunjukan tradisional.

Mode tampilan pertama adalah wayang berwarna. Tampilan bayangan menjadi tahap lanjutan jika siluet, keterbacaan, dan kinerja sudah memenuhi target. Aspek layar, skala karakter, dan area aman dialog diuji dengan dua pemain sekaligus.

## 4. Paket aset dan proses pembuatannya

Target rilis pertama: **tiga karakter dan satu gunungan**.

| Aset | Peran produk | Kebutuhan sebelum integrasi |
| --- | --- | --- |
| Gatotkaca / Gathutkaca Krodha | Karakter pertama untuk membuktikan mutu visual dan animasi | Rujukan bentuk Jekdong, gambar sumber yang dapat diperiksa, dan metadata gaya |
| Semar | Karakter dengan dialog pengayoman | Rujukan figur sesuai gaya pilihan; bahasa tidak mengaku sebagai kutipan pakem |
| Bagong | Pasangan interaksi dua pemain | Desain dan suara yang berdiri sendiri; bukan sekadar mengganti nama Cepot |
| Gunungan | Identitas pembuka dan transisi | Referensi bentuk yang jelas dan pemisahan fungsi dekoratif dari keterangan simbolis |

Arjuna dapat menyusul setelah paket utama selesai. Tokoh lintas daerah tidak diklaim eksklusif berasal dari Jawa Timur; yang didokumentasikan adalah representasi gayanya.

Alur produksi setiap aset:

1. Susun lembar referensi: asal objek, tokoh, daerah/gaya, URL, pemilik gambar, dan kondisi penggunaan.
2. Buat gambar konsep resolusi tinggi. Jika memakai generasi gambar, labeli sebagai ilustrasi interpretatif dan cocokkan dengan referensi; penamaan prompt saja belum membuktikan akurasi budaya.
3. Siapkan sumber berlapis dengan badan serta empat bagian lengan. Kepala default menyatu pada badan; gestur membungkuk memakai gerak badan.
4. Siapkan pivot bahu/siku, overlap sendi, urutan lapisan, batang kendali, dan area aman. Tuding tangan diatur mengikuti posisi tangan; gapit utama mengikuti badan. Istilah lokal diperiksa sebelum menjadi teks edukasi.
5. Ekspor PNG transparan untuk thumbnail dan sumber raster; SVG rig untuk runtime; `pivots.json`/metadata per tokoh. SVG yang membungkus PNG disebut **rig SVG dengan layer raster**, bukan vektor murni.
6. Uji semua gestur, dua arah hadap, satu/dua pemain, serta pose ekstrem yang memang akan dipakai. Perbaiki celah potongan sebelum menggandakan proses ke karakter lain.

Kontrak kompatibilitas awal mempertahankan `grup-wayang`, `badan`, dan hierarki `lengan-atas-*` → `lengan-bawah-*` serta atribut pivot. Layer tambahan bersifat opsional. Gambar yang bagus tetapi belum memiliki rig dicatat sebagai konsep, bukan aset siap animasi.

Target teknis awal: master minimal sekitar 1.600 piksel pada sisi panjang, rig runtime diupayakan di bawah 1 MB per karakter, dan karakter kedua dimuat saat dibutuhkan. Target ini dapat disesuaikan berdasarkan hasil render, bukan dengan menghilangkan detail penting secara buta.

## 5. Fitur fakta menarik

Konten awal tersedia dalam [12 draf fakta bersumber](../../research/wayang-jatim-facts.draft.json). Draf tersebut belum dihubungkan ke aplikasi.

Perilaku kartu **Tahukah Kamu?**:

- Satu fakta tampil saat masuk. Pengguna dapat memilih **Fakta berikutnya**, **Baca konteks**, atau **Sumber**.
- Kartu berada di bawah/di samping panggung dan tidak menutupi karakter, preview kamera, maupun balon dialog.
- Default pergantian manual. Kandidat dipilih tanpa pengulangan sampai kumpulan yang sesuai habis; satu fakta tidak diganti hanya karena gestur berulang.
- Fakta sesuai tokoh mendapat prioritas ketika karakter diganti, tanpa memutus bacaan yang sedang terbuka.
- Isi ringkas tetap; tidak ada suara fakta otomatis yang bertabrakan dengan suara karakter.
- Saat layar penuh, tombol Budaya dan kartu ringkas berada di dalam elemen fullscreen yang sama atau dapat disembunyikan. Uji secara khusus karena fullscreen saat ini hanya mencakup elemen panggung.

Panel **Jelajahi budaya**:

- Kategori: **Daerah & cengkok**, **Tokoh**, **Musik & gerak**, **Tradisi masyarakat**.
- Setiap entri menampilkan judul, teks singkat, konteks daerah/tokoh, sumber, dan catatan pembatasan bila diperlukan.
- Satu panel aktif pada satu waktu. Pengguna bisa menutup dengan tombol atau Escape; fokus kembali ke pemicu dan pintasan gestur tidak mengambil input saat panel dibaca.
- Koneksi, kamera, dan penerimaan data tetap berjalan. Saat panel bacaan dibuka, cue suara/dialog baru ditahan sementara; ketika ditutup, hanya input terbaru diterapkan, tanpa memutar antrean suara yang menumpuk. Transisi jeda/tidur tidak memotong sesi membaca.
- Data tersedia lokal. Membaca fakta tidak membutuhkan internet; membuka situs sumber memerlukan koneksi dan dilakukan atas klik pengguna.
- Jika berkas fakta gagal dimuat, panggung tetap berfungsi dan panel memberi pesan singkat.

Struktur data runtime yang direncanakan memisahkan `sources`, `facts`, `characters`, dan `credits`. Tiap fakta minimal memiliki `id`, `title`, `text`, `category`, `scope`, `character_ids`, `source_refs`, serta status pemeriksaan. Field pemeriksaan editorial tidak perlu ditonjolkan di alur pengguna.

## 6. Dialog, musik, dan ketepatan konten

- Bahasa Indonesia menjadi dasar. Ungkapan Jawa Timuran ditambahkan setelah pemeriksaan makna dan pelafalan; jangan menyamakan seluruh wilayah dengan satu dialek.
- Dialog karakter adalah tulisan baru untuk aplikasi. Bedakan dari kutipan lakon atau ucapan dalang historis.
- Audit `audio.js`, `dialog.js`, `dialog_audio.js`, `voice.js`, serta kredit audio sebagai satu paket. Perubahan nama karakter mencakup teks, suara, pemetaan, dan metadata.
- Audio kacapi dan rekaman berlatar tradisi lain tidak digunakan sebagai bukti bunyi khas Jekdong. Prioritaskan rekaman Jawa Timuran yang jelas asal dan izinnya. Sampai tersedia, gunakan cue terbatas dengan label sumber yang jujur.
- Musik diturunkan saat dialog; pergantian karakter membatalkan suara lama; dialog dari pemain kedua tetap menggunakan profil pemain kedua.
- Jangan menampilkan klaim tanggal asal, tokoh pencipta tunggal, jumlah punakawan universal, atau pengakuan UNESCO khusus Jekdong tanpa bukti yang mendukungnya.

## 7. Tahap pelaksanaan dan kriteria selesai

| Tahap | Pekerjaan | Hasil yang harus dapat diperiksa |
| --- | --- | --- |
| 0 — Riset & rencana | Branch, kajian sumber, ruang lingkup, draf fakta | Dokumen ini, catatan riset, dan 12 fakta dengan rujukan; selesai pada tahap perencanaan |
| 1 — Desain | Pembuka, panggung 1/2 pemain, pemilih tokoh, kartu fakta, panel budaya, panduan, pengaturan, state gagal | Preview ukuran desktop dan ponsel dengan aset konsep yang diberi label |
| 2 — Satu aset tuntas | Gatotkaca: referensi → sumber berlapis → rig → pose | Contact sheet semua gestur, hasil pemeriksaan rig, dan cuplikan gerak; dipakai sebagai standar produksi |
| 3 — Paket utama | Semar, Bagong, gunungan, thumbnail, metadata dan kredit | Tiga karakter konsisten, sendi bersih, dapat dimainkan dua arah |
| 4 — Integrasi tampilan | Komponen UI, registry karakter, pemuatan aset, fullscreen, status kamera, mode latihan | Seluruh alur utama dapat dimainkan dengan kontrol baru |
| 5 — Budaya & audio | Fakta lokal, panel bacaan, rujukan, naskah, penyesuaian audio | 12 fakta dapat dibaca; sumber terlihat; bacaan tidak bentrok dengan suara/gestur |
| 6 — QA & dokumentasi | Tes regresi, uji browser dan kamera, performa, README, kredit, bahan demo | Bukti pengujian, screenshot aktual, daftar keterbatasan, serta panduan demo yang sesuai aplikasi |

Tahap 2 harus lolos sebelum memproduksi semua karakter. Implementasi berlanjut di branch yang sama dengan commit terpisah untuk desain dasar, aset, budaya, dan verifikasi, sehingga perubahan mudah ditinjau.

## 8. Peta perubahan kode

| Lokasi | Rencana perubahan |
| --- | --- |
| `frontend/index.html` | Identitas baru, pembuka, panel budaya, kartu fakta, pemilih karakter |
| `frontend/css/style.css`, `teater.css` | Layout, kelir, bayangan, tipografi lokal, kontras, ukuran kontrol, responsif |
| `frontend/js/app.js` | Integrasi registry dan pergantian tokoh tanpa mengubah kontrak prediksi |
| `frontend/js/animation.js` | Penyesuaian pivot, kedalaman bayangan, dan layer tambahan bila diperlukan |
| `frontend/js/theater.js`, `theater-core.js` | State panel bacaan, fokus, kendali cue, fullscreen; state pertunjukan tetap diuji |
| `frontend/js/culture.js`, `culture-core.js` (baru) | Render konten dan pemilihan fakta; pemilihan fakta dapat diuji tanpa DOM |
| `frontend/data/characters.json`, `culture.json` (baru) | Metadata karakter dan konten bersumber yang sudah siap terbit |
| `frontend/assets/` | Rig, thumbnail, sumber produksi yang terpilih, font, audio, dan kredit |
| `frontend/tools/` | Adaptasi checker rig ke registry dan tes logika fitur budaya |
| `shared/gesture_map.json` | Pemeriksaan label/hint dan istilah; ID enam kelas tetap |
| `README.md`, `models/README.md` | Ruang lingkup, cara demo, model yang tersedia, screenshot baru, dan keterbatasan |

Nama file baru merupakan rancangan; belum dibuat sebagai kode runtime pada tahap ini.

## 9. Verifikasi yang wajib pada implementasi

1. Jalankan tes frontend yang ada serta tes backend logika, kamera tiruan, dua tangan, model service, dan integrasi sampel MLP. Catat baseline agar perubahan kosmetik tidak memutus alur.
2. Uji rig semua karakter pada keenam gestur, netral, perubahan arah, pergantian cepat, dan kombinasi dua pemain. Periksa celah, potongan lengan, bayangan, dan batang kendali secara visual; tes struktur SVG saja belum cukup.
3. Uji pemilihan fakta tanpa pengulangan, filter konteks, sumber yang hilang, data invalid, serta penutupan panel. Cocokkan setiap klaim dengan locator sumbernya.
4. Uji desktop 1366×768, 1440×900, 1920×1080 dan ponsel 390×844; periksa overflow, pemotongan panggung, fokus keyboard, reduced motion, kontras teks, dan kontrol sentuh minimal sekitar 44 piksel.
5. Uji perangkat presentasi dengan kamera nyata: jarak tangan, cahaya terang/redup, dua tangan, kamera dimatikan, kamera gagal, dan sambungan pulih. Pengujian tiruan tidak menggantikan tahap ini.
6. Ukur FPS pipeline, waktu respons gestur, dan kelancaran browser sebelum/sesudah pada perangkat yang sama. Target awal: animasi sekitar 50–60 FPS pada laptop demo dan tanpa penurunan FPS pipeline lebih dari sekitar 10% dari baseline; jika gagal, kurangi efek dan ukur ulang.
7. Uji internet terputus setelah setup: fakta, font, rig, dan cue audio lokal tetap tersedia. Sediakan mode latihan untuk presentasi saat kamera bermasalah.
8. Sinkronkan README dengan hasil yang benar-benar diuji. Status `camera: false`, mode latihan, dan confidence prediksi tidak dipresentasikan sebagai keberhasilan deteksi nyata.

## 10. Ketergantungan dan batas hasil

Rujukan tertulis untuk fakta tersedia; akses terbuka pada teks belum otomatis memberi izin menyalin seluruh foto atau rekaman pihak ketiga. Gaya dan mutu budaya aset tetap memerlukan pencocokan dengan objek rujukan. Tinjauan praktisi/dalang, jika tersedia dari kelompok, akan menguatkan hasil; dokumen ini tidak menyatakan validasi ahli sudah terjadi.

Baseline audit sebelumnya mencatat 67 tes frontend lolos, empat rig lama lolos, dan 119/120 sampel uji integrasi MLP benar. Itu bukan angka akurasi webcam langsung. Browser lokal sebelumnya tidak dapat diluncurkan karena pembatasan lingkungan, sehingga tampilan baru belum memiliki bukti render; verifikasi visual dan kamera dicatat sebagai pekerjaan implementasi yang harus diselesaikan.
