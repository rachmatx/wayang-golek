# Sinkronisasi dialog, bubble, dan lakon

Diperiksa 18 November 2026. Lingkup: penjadwalan aplikasi, bukan mengganti suara atau model deteksi tangan.

## Temuan sumber primer

1. [Web Speech API specification](https://wicg.github.io/speech-api/): `speak()` menambah ucapan ke antrean; `start`, `end`, dan `error` memiliki arti berbeda. Pembatalan dapat menghasilkan error `canceled`/`interrupted`; jangan menunggu `end` saja setelah membatalkan. `cancel()` menghapus antrean dan menghentikan ucapan berjalan.
2. [Chrome Developers — play() request was interrupted](https://developer.chrome.com/blog/play-request-was-interrupted/): pemanggilan `play()` bersifat asinkron. `pause()`/`load()` dapat menolak promise yang masih tertunda. Penolakan itu harus ditangani tanpa menghidupkan kembali transport yang sengaja dibatalkan.
3. [MDN — media ended](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event): `ended` menunjukkan media mencapai akhir. Pemanggilan `play()` bukan bukti media sudah selesai; bubble dan langkah lakon tidak boleh memakai timer singkat sebagai pengganti penyelesaian media.

## Keputusan implementasi

Keputusan berikut merupakan rancangan aplikasi berdasarkan perilaku API, bukan angka baku dari dokumentasi browser:

| Masalah | Perilaku baru |
| --- | --- |
| P2 membalas setelah 0,65–1,1 detik walau P1 masih bicara | Tunggu penyelesaian suara, minimum baca, kemudian jeda tenang sekitar 450 ms |
| Langkah baru memotong balasan | Tunggu P2 selesai dan jeda sekitar 650 ms |
| Bubble hilang setelah 2,4 detik | Tahan sampai ucapan selesai; minimal 2,2 detik, bertambah sesuai jumlah kata; lepas dengan ekor 350 ms |
| Perubahan tangan menghasilkan banyak ucapan | Caption terbaru langsung, suara menunggu kestabilan 280 ms; satu ucapan aktif, tanpa backlog gestur |
| Rekaman gagal/terlambat | Hentikan transport sebelum TTS fallback; validasi identitas sesi dan generasi pada callback/promise |
| TTS tidak memulai atau tidak mengakhiri | Startup timeout 5 detik; rekaman menunggu 4 detik sebelum fallback; watchdog setelah start 15–60 detik mengikuti panjang/durasi |
| Suara dimatikan/tidak tersedia | Tempo memakai waktu baca minimum; tidak menunggu audio yang tidak akan diputar |
| Pengguna menjeda dan melanjutkan | Batalkan suara, ulangi kalimat yang terpotong saat lanjut; animasi tidak diulang |
| Input saat main lakon | Gerak tangan tetap diterapkan; narasi dipilih pengendali lakon, bukan dialog gestur bebas |

Angka waktu adalah titik awal yang dapat dituning setelah uji pengguna. Tidak ada klaim bahwa semua browser memiliki latensi atau kualitas TTS sama. Bubble ditampilkan saat instruksi dialog diterima agar respons gerak langsung terasa; ia tetap terlihat selama menunggu suara mulai dan selama pemutaran.

## Batas verifikasi

Unit test mensimulasikan callback telat, transport gagal, suara panjang, mute, dan pembatalan. QA browser memakai transport suara simulasi enam detik dengan latensi 400 ms dan input kamera sintetis, melalui kode aplikasi asli. Kualitas audio fisik, dukungan suara Indonesia di OS, dan akurasi webcam perlu diuji pada perangkat pengguna.
