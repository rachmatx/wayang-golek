# Kredit Audio — Wayang Golek

Semua suara di folder ini adalah rekaman asli (bukan lagi sintesis WebAudio).
Sumber paket lengkap + panduan ada di Google Drive pemilik repo, folder
"Wayang Golek - Audio Assets". Lisensi per berkas:

## Musik latar (`musik/`)

| Berkas | Isi | Sumber | Lisensi |
| --- | --- | --- | --- |
| `latar-panggung.ogg` | Gamelan Kraton Ngayogyakarta "angka 1", dipotong jadi loop mulus 84 dtk (crossfade 4 dtk) | Wikimedia Commons, "Pengrawit Kraton Ngayogyakarta" | CC BY 4.0 |
| `latar-jeda.ogg` | Gender Wayang slendro (rekaman 1931), dipotong jadi loop mulus 76 dtk (crossfade 4 dtk) | Wikimedia Commons, katalog Odeon/Beka | Public domain |

## Efek gamelan (`sfx/`)

| Berkas | Isi | Sumber | Lisensi |
| --- | --- | --- | --- |
| `pukulan-gong-ageng.wav` | Satu pukulan gong ageng, dipotong dari "Gong Lagu Kebiar" (1931) ±123 dtk | Wikimedia Commons | Public domain |
| `pukulan-bonang.wav` | Satu pukulan bonang, dipotong dari rekaman di bawah | Jurusan Karawitan ISBI Bandung via Wikimedia Commons | CC BY-SA 4.0 |
| `pukulan-peking.wav` | Satu pukulan peking, dipotong dari rekaman di bawah | Jurusan Karawitan ISBI Bandung via Wikimedia Commons | CC BY-SA 4.0 |
| `pukulan-saron.wav` | Satu pukulan saron cempres, dipotong dari rekaman di bawah | Jurusan Karawitan ISBI Bandung via Wikimedia Commons | CC BY-SA 4.0 |
| `pukulan-kendang.wav` | Satu hentakan kendang, dipotong dari rekaman di bawah | Jurusan Karawitan ISBI Bandung via Wikimedia Commons | CC BY-SA 4.0 |
| `kacapi-hormat.ogg` | Frase kacapi indung degung (dipakai untuk gestur hormat) | Jurusan Karawitan ISBI Bandung via Wikimedia Commons | CC BY-SA 4.0 |

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

Buatan sendiri dengan ffmpeg/Python (sintesis prosedural sederhana), bebas
lisensi: `whoosh-tirai.wav`, `ketuk-kayu-keprak.wav`, `suasana-malam.wav`
(ambien jangkrik untuk babak tidur).
