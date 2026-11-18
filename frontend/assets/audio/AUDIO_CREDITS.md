# Kredit Audio — Panggung Wayang Jawa Timuran

Audit metadata: **18 November 2026, v0.8.0**. Aset biner tidak diganti pada batch ini.
Kredit lama hanya menyebut koleksi/institusi dan tidak menyimpan URL unduhan atau titik potong. Karena itu, pemeriksaan halaman sumber di bawah **belum membuktikan kecocokan waveform berkas turunan**. Inventaris lokal beserta durasi dan SHA-256 tersedia di [AUDIO_INVENTORY.json](AUDIO_INVENTORY.json).

## Musik latar (`musik/`)

| Berkas | Asal yang dicatat sebelumnya | Pembuat / halaman sumber | Lisensi pada halaman sumber | Hasil audit |
| --- | --- | --- | --- | --- |
| `latar-panggung.ogg` | Potongan 84 detik, crossfade 4 detik, dari Gamelan angka 1 Kraton Ngayogyakarta | **RTB45**, rekaman 6 November 2014; [Commons](https://commons.wikimedia.org/wiki/File:Gamelan_angka_1_Kraton_Ngayogyakarta.ogg), [Freesound 255544](https://freesound.org/people/RTB45/sounds/255544/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Judul, pembuat, dan lisensi sumber ditemukan. Kredit sebelumnya keliru memakai nama kelompok pengrawit sebagai pembuat rekaman. Rekaman pembanding tidak berhasil diunduh (HTTP 403), sehingga kecocokan potongan belum diuji. |
| `latar-jeda.ogg` | Potongan 76 detik, crossfade 4 detik, dari Gender Wajang Selendero (1931) | Pembuat tidak diketahui; [Commons](https://commons.wikimedia.org/wiki/File:Gender_Wajang_Selendero_(1931).ogg) | Halaman memakai tag public domain dan menyebut perbedaan perlindungan antarnegara. | Sumber mendeskripsikan **musik Bali**, bukan Jawa Timur. Klaim lama “public domain” saja tidak cukup sebagai audit distribusi lintas wilayah. Verifikasi hak dan kecocokan potongan masih terbuka. |

Kredit ini mencatat perubahan pemotongan/crossfade sebagaimana dokumentasi lama; tidak mengklaim telah mereproduksi proses itu. BGM belum dipetakan tempo atau pukulannya, sehingga tidak diklaim sinkron dengan karawitan atau autentik khusus Jekdong.

## Efek instrumen (`sfx/`)

Empat sumber WAV berikut merupakan **kandidat yang sesuai dengan deskripsi kredit lama**. Halaman sumber mencantumkan Salomo Christian Hutajulu sebagai pembuat rekaman, bukan ISBI Bandung sebagai pemegang kredit rekaman. Ada versi video dengan pembuat berbeda; versi itu tidak boleh dianggap otomatis sama dengan WAV atau potongan lokal.

| Berkas lokal | Kandidat sumber primer | Lisensi sumber | Status berkas turunan |
| --- | --- | --- | --- |
| `pukulan-bonang.wav` | Salomo Christian Hutajulu, [Bonang Salendro koleksi Jurusan Karawitan ISBI Bandung](https://commons.wikimedia.org/wiki/File:Bonang_Salendro_koleksi_Jurusan_Karawitan_ISBI_Bandung.wav) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Titik potong dan kecocokan waveform belum terbukti. |
| `pukulan-peking.wav` | Salomo Christian Hutajulu, [Peking Gamelan Degung koleksi Jurusan Karawitan ISBI Bandung](https://commons.wikimedia.org/wiki/File:Peking_Gamelan_Degung_koleksi_Jurusan_Karawitan_ISBI_Bandung.wav) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Titik potong dan kecocokan waveform belum terbukti. |
| `pukulan-saron.wav` | Salomo Christian Hutajulu, [Saron Cempres Gamelan Degung koleksi Jurusan Karawitan ISBI Bandung](https://commons.wikimedia.org/wiki/File:Saron_Cempres_Gamelan_Degung_koleksi_Jurusan_Karawitan_ISBI_Bandung.wav) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Titik potong dan kecocokan waveform belum terbukti. |
| `pukulan-kendang.wav` | Salomo Christian Hutajulu, [Kendang koleksi Jurusan Karawitan ISBI Bandung](https://commons.wikimedia.org/wiki/File:Kendang_koleksi_Jurusan_Karawitan_ISBI_Bandung.wav) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Titik potong dan kecocokan waveform belum terbukti. |
| `pukulan-gong-ageng.wav` | Kredit lama menyebut “Gong Lagu Kebiar (1931)” sekitar 123 detik. Halaman persisnya belum ditemukan/diakses. | Kredit lama menyebut public domain; **belum terverifikasi**. | Pembuat, sumber persis dan izin distribusi perlu dilengkapi. |
| `kacapi-hormat.ogg` | Kredit lama menyebut kacapi indung degung, koleksi ISBI Bandung. | Kredit lama menyebut CC BY-SA 4.0; sumber persis belum terverifikasi. | Arsip lama; **tidak dimuat atau dipakai runtime v0.8.0**. |

Halaman CC BY/CC BY-SA meminta kredit, tautan lisensi dan keterangan perubahan; CC BY-SA juga mensyaratkan adaptasi memakai lisensi yang sama/kompatibel. Jangan menghapus atribusi ketika asal potongan akhirnya dicocokkan. Tidak ada klaim bahwa institusi atau pembuat sumber mendukung aplikasi ini. Rekaman koleksi Bandung merupakan sampel lintas tradisi, bukan bukti iringan khusus Jawa Timuran.

## Suara dialog (`dialog/<karakter>/`, 92 berkas)

Satu berkas per baris naskah `js/dialog.js`, dipetakan oleh
`js/dialog_audio.js`; baris tanpa berkas diucapkan lewat speechSynthesis
browser (cadangan di `js/voice.js`). Dua sumber:

- **Fish Audio S2.1 Pro** (digenerate pemilik repo, 22 Okt 2026): Klasik 8
  baris (sambutan, sambutan2, telapak_terbuka 2, kepalan 1, telunjuk 1,
  dua_jari 2, jempol 1, ok 2) dan Cepot 10 baris (sambutan, sambutan2,
  telapak_terbuka 1–2, kepalan 1–2, telunjuk 1, dua_jari 1, jempol 2, ok 2).
  Di repo hanya diratakan kenyaringannya (loudnorm −18 LUFS) dan dibuang
  diam di tepi berkas; isi ucapan tidak diubah.
- **TTS neural Bahasa Indonesia + olah karakter** (ffmpeg rubberband:
  pitch/formant/tempo + EQ per tokoh): Gatotkaca 23 baris, Arjuna 23 baris,
  dan sisa baris Klasik (15) serta Cepot (13) yang belum tergenerate di
  Fish Audio.

## Efek panggung & ambien (`sfx/`, `ambien/`)

Menurut kredit lama, dibuat dengan ffmpeg/Python (sintesis prosedural sederhana): `whoosh-tirai.wav`, `ketuk-kayu-keprak.wav`, `suasana-malam.wav`
(ambien jangkrik untuk babak tidur).

## Penyesuaian Jawa Timuran — 18 November 2026

Musik latar lama merupakan sampel lintas tradisi; **bukan** rekaman autentik khusus Jekdong. Pada v0.2/v0.3 musik default mati dan dapat dinyalakan di Pengaturan dengan keterangan asal. Cue hormat (`jempol`) sekarang memakai saron, bukan kacapi. Cue tersebut adalah interpretasi interaksi digital, bukan reproduksi iringan pakem.

Semar dan Bagong menggunakan naskah original aplikasi serta profil suara browser yang berbeda. Ketersediaan suara Indonesia bergantung pada perangkat. Tidak memakai ulang rekaman Cepot sebagai suara Bagong. Karakter lama dan berkasnya tetap menjadi arsip teknis.

## Kontrol audio v0.3.1 — 18 November 2026

Audio kini dapat diatur melalui tombol Audio di dekat panggung: dialog, musik, dan SFX mempunyai toggle serta volume sendiri. Untuk pengunjung baru, musik siap menyala pelan setelah panggung dibuka; pilihan mati yang pernah disimpan tetap dihormati. Asal rekaman di atas tetap berlaku, termasuk keterangannya sebagai sampel lintas tradisi. Tidak ada aset audio baru atau perubahan klaim budaya pada tahap ini.

## Penyesuaian v0.8.0

Aksen persiapan/puncak/pulih memakai waktu animasi aktif tiap tokoh. Langkah memakai jarak yang benar-benar ditempuh; telunjuk yang diam tidak mengulang bunyi. Bunyi duet berbagi jarak onset minimum 120 ms dan maksimum enam sumber SFX aktif, dengan kompresor pada bus SFX. Variasi gain kecil dipakai bergantian; tidak ada pitch-shift yang diklaim sebagai laras baru. BGM tetap independen dari aksen ini.

Audit ini belum menutup asal semua aset lama atau izin layanan TTS. Langkah berikutnya ialah memperoleh berkas sumber asli/proses build, mencocokkan potongan, dan melengkapi hak aset arsip atau menggantinya dengan rekaman yang dapat diverifikasi. Tidak ada aset baru yang diunduh atau lisensi yang diasumsikan dari nama berkas saja.
