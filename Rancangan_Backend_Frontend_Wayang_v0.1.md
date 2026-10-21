# RANCANGAN BACKEND + FRONTEND

*Bagian Programmer 1 (Rachmat) — pelengkap SDD v0.2. Dokumen ini merancang aplikasinya saja: model dibuat P2, rig wayang dibuat P2, yang dirancang di sini adalah cara memakai keduanya.*

| Item | Isi |
| --- | --- |
| Versi | 0.1 — 20 Oktober 2026 |
| Acuan | SDD v0.2 Bab 3 (6 gestur), Bab 4 (3 aturan teknis), Bab 5 (serah-terima & ID layer SVG) |
| Prinsip utama | Kerjakan dari yang bisa diuji tanpa menunggu P2: backend jalan dengan data contoh dulu, frontend bergerak dengan dummy dulu. Model dan SVG asli tinggal dipasang di akhir. |

## 1. Gambaran Besar: Dua Saluran, Dua Tugas

Backend dan frontend terhubung lewat dua saluran yang tugasnya beda — jangan dicampur:

| Saluran | Isinya | Kenapa Dipisah |
| --- | --- | --- |
| HTTP — halaman & video | Halaman web (GET /) dan siaran gambar webcam (GET /video_feed, format MJPEG) | Gambar itu berat dan mengalir terus; jalurnya sendiri. |
| WebSocket — hasil prediksi | JSON kecil: gestur, confidence, posisi tangan, titik landmark (alamat /ws/predict) | Hasil prediksi harus sampai cepat dan ringan; tidak perlu menunggu gambar. |

Kamera dipegang backend (OpenCV di laptop demo), bukan browser. Alasannya: pipeline pengolahan citranya memang di backend — itu yang dinilai matkul — dan cara ini menghindari masalah izin kamera browser. Frontend hanya menampilkan gambar yang dikirim backend.

```
Webcam
  | (OpenCV, di thread khusus backend)
  v
Pipeline: mirror -> RGB -> MediaPipe (21 landmark) -> normalisasi (63 angka)
  -> model P2 menebak -> smoother meratakan hasil
  |                              |
  v MJPEG /video_feed            v WebSocket /ws/predict (JSON)
Frontend: tampilkan gambar       Frontend: gerakkan wayang + gambar skeleton
```

## 2. Rancangan Backend

### 2.1 Struktur File dan Tugas Tiap File

```
backend/
  app.py            # FastAPI: semua endpoint + WebSocket. File utama, isinya tipis —
                    #   logika ditaruh di file bawah ini, app.py cuma merakit
  config.py         # semua angka setelan (Bab 2.4) dalam satu tempat
  camera.py         # buka webcam, ambil frame, mirror, sediakan frame terakhir
  hand_processor.py # MediaPipe: frame -> 21 landmark (atau 'tidak ada tangan')
  features.py       # normalisasi landmark -> 63 angka.
                    #   ISI FILE INI HARUS SAMA PERSIS dengan yang dipakai P2 saat training
  model_service.py  # muat model.pkl + labels.json dari P2, tebak gestur + confidence
  smoother.py       # majority vote 5 frame + ambang 0,60 + aturan tahan 3 frame
  state.py          # hasil terakhir pipeline, dibaca app.py untuk dikirim ke frontend
  stream.py         # ubah frame jadi siaran MJPEG untuk /video_feed
```

- **Satu thread khusus pipeline. **Pengolahan gambar itu berat dan memblokir. Pipeline jalan di thread-nya sendiri yang terus berputar dan menyimpan hasil terakhir di state.py. Server tidak ikut macet, WebSocket tetap responsif.
- **features.py adalah file paling sensitif. **Satu-satunya file yang isinya ditentukan berdua dengan P2 (SDD Bab 4 aturan 2). Begitu file ini disepakati, jangan diubah sepihak.
### 2.2 Alur Satu Putaran Pipeline

- 1. camera.py mengambil frame terbaru (640×480), membaliknya horizontal (mirror).
- 2. hand_processor.py mengubah frame ke RGB, menjalankan MediaPipe Hands (max_num_hands = 1, model_complexity = 0).
- 3. Tidak ada tangan → state diisi state = no_hand, putaran selesai. Frontend yang mengurus pose netralnya.
- 4. Ada tangan → features.py menormalkan 21 landmark menjadi 63 angka (kurangi titik wrist, bagi jarak wrist ke titik 9).
- 5. model_service.py menebak: keluar label + confidence + 3 tebakan teratas (top-3, buat ditampilkan di panel).
- 6. smoother.py meratakan: label final = suara terbanyak dari 5 hasil terakhir; confidence di bawah 0,60 → state = unknown; label baru harus muncul 3 frame berturut-turut sebelum dinyatakan final.
- 7. state.py menyimpan hasil final + titik landmark mentah (x, y) + posisi wrist + FPS pipeline. app.py mengirimkannya lewat WebSocket (Bab 2.3).
### 2.3 Endpoint dan Pesan WebSocket

| Jalur | Fungsi | Jawaban |
| --- | --- | --- |
| GET / | Halaman frontend | index.html |
| GET /video_feed | Siaran gambar webcam (MJPEG); skeleton digambar frontend dari landmark WS | multipart/x-mixed-replace |
| GET /api/health | Cek backend hidup + status komponen | {"status": "ok", "camera": true, "model": "mlp", "model_loaded": true} |
| GET /api/gesture-map | Kirim isi shared/gesture_map.json ke frontend | JSON pemetaan gestur → animasi |
| WS /ws/predict | Kirim hasil prediksi terus-menerus | JSON Bab ini (di bawah) |

Pesan WebSocket dari backend ke frontend. Empat field pertama persis kontrak SDD — field sisanya tambahan untuk panel frontend, tidak mengubah kontrak:

```
{
  "type": "prediction",
  "gesture": "dua_jari",        // kontrak SDD (atau null)
  "confidence": 0.92,          // kontrak SDD
  "wrist_x": 0.54, "wrist_y": 0.41,   // kontrak SDD
  "state": "ok",               // kontrak SDD: ok | no_hand | unknown
  "top3": [["dua_jari", 0.92], ["telapak_terbuka", 0.05], ["ok", 0.02]],
  "landmarks": [[0.51, 0.44], ...],   // 21 titik [x, y] untuk gambar skeleton di frontend
  "model": "mlp", "fps": 18
}
```

Pesan dari frontend ke backend (perintah kontrol, semuanya opsional dan aman diabaikan backend versi awal):

| Perintah | Isi | Gunanya |
| --- | --- | --- |
| {"command": "set_model", "model": "rf"} | Ganti model aktif mlp ↔ rf | Demo perbandingan dua model secara langsung |
| {"command": "set_threshold", "value": 0.7} | Ubah ambang confidence | Disambungkan ke slider ambang di frontend |
| {"command": "ping"} | Cek koneksi | Backend membalas {"type": "pong"} |

### 2.4 Setelan (config.py) — Semua Angka di Satu Tempat

| Setelan | Nilai Awal | Keterangan |
| --- | --- | --- |
| CAMERA_INDEX | 0 | Webcam utama laptop |
| FRAME_WIDTH × HEIGHT | 640 × 480 | Cukup untuk landmark, ringan di CPU lama |
| MEDIAPIPE_COMPLEXITY | 0 | Model tangan paling ringan |
| MIN_DETECTION_CONFIDENCE | 0.5 | Dari SDD v0.1; catat bila diubah |
| CONFIDENCE_THRESHOLD | 0.60 | Di bawah ini = unknown |
| SMOOTHING_WINDOW | 5 frame | Majority vote |
| MIN_HOLD_FRAMES | 3 frame | Anti-berkedip sebelum label dinyatakan final |
| WS_SEND_INTERVAL | 0.05 detik | Kirim hasil final maks ±20 kali/detik, dan hanya bila berubah atau 4 kali/detik untuk detak (heartbeat data) |
| MODEL_PATH | models/model_mlp.pkl | Berkas dari P2 |
| LABELS_PATH | models/labels.json | Berkas dari P2 |

### 2.5 Kalau Ada yang Rusak (Aturan Cadangan Backend)

| Masalah | Perilaku Backend yang Dirancang |
| --- | --- |
| File model belum ada / dari P2 belum datang | Backend TETAP JALAN dalam mode tanpa model: /api/health melaporkan model_loaded = false, WebSocket mengirim state = unknown. Frontend dan demo dummy tetap bisa dikembangkan dan diuji. |
| Webcam tidak terbuka | Backend jalan, /video_feed mengirim gambar hitam bertuliskan 'kamera tidak tersedia', health melaporkan camera = false. Jangan crash — error kamera saat demo harus terlihat sebagai pesan, bukan server mati. |
| Model gagal menebak (exception) | Tangkap error per frame, hitung, kirim state = unknown. Satu frame jelek tidak boleh mematikan pipeline. |
| Frontend putus lalu menyambung lagi | WebSocket menerima koneksi baru kapan saja; pipeline tidak di-restart. |
| Dua model (MLP & RF) tersedia | model_service memuat keduanya bila file-nya ada; set_model memilih yang aktif; default = MLP. |

## 3. Rancangan Frontend

### 3.1 Tata Letak Halaman (Satu Halaman Saja)

```
+------------------------------------------------------------------+
| Wayang Digital Gestur Tangan        [status: terhubung] [menu]   |
+----------------------------------------+-------------------------+
|                                        |  KAMERA                   |
|   PANGGUNG                             |  [gambar webcam +         |
|   [        wayang SVG        ]         |   skeleton di atasnya]    |
|   [     latar kelir sederhana ]        +-------------------------+
|                                        |  HASIL BACAAN             |
|                                        |  Gestur: Dua Jari         |
|                                        |  Yakin: 92% [====----]    |
|                                        |  Model: MLP | FPS: 18     |
+----------------------------------------+-------------------------+
| Panduan gestur: [ikon x6]      [Kontrol demo v]  (tersembunyi,   |
|                                 klik untuk membuka)              |
+------------------------------------------------------------------+
```

- **Yang besar cuma dua: **panggung wayang (kiri, ±65% lebar) dan kolom kamera + hasil bacaan (kanan). Itu yang dilihat dosen saat demo.
- **Selebihnya dilipat. **Kontrol demo, panduan gestur, dan info pipeline lengkap disembunyikan secara bawaan dan baru tampil bila diklik — halaman tidak ramai.
- **Satu halaman, tanpa pindah-pindah. **Tidak ada halaman login, riwayat, atau pengaturan terpisah. Ini aplikasi demo satu layar.
### 3.2 Struktur File Frontend

```
frontend/
  index.html      # kerangka halaman (tata letak Bab 3.1)
  css/style.css   # tampilan + transisi animasi wayang (Bab 3.3)
  js/app.js       # otak halaman: pegang state, sambungkan semua modul
  js/ws_client.js # koneksi WebSocket: sambung, putus, sambung-ulang otomatis
  js/panel.js     # gambar skeleton di canvas + isi panel hasil bacaan & top-3
  js/animation.js # mesin pose wayang (Bab 3.3) — membaca gesture_map.json
  js/dummy.js     # mode dummy: tombol + keyboard kirim gestur palsu
  assets/         # wayang.svg dari P2 ditaruh di sini (tidak diedit P1)
```

### 3.3 Mesin Animasi: Sistem Pose, Bukan Animasi Per Frame

Frontend tidak menggambar ulang wayang setiap frame. Yang dikerjakan: setiap gestur punya pose — daftar sudut putar target untuk tiap layer SVG — dan browser menggerakkan layer ke pose itu dengan transisi CSS. Halus, ringan, dan gampang diatur ulang angkanya tanpa menyentuh gambar.

| Istilah | Artinya di Rancangan Ini |
| --- | --- |
| Pose | Satu gestur = satu pose: {layer: sudut} + durasi gerak (ms) + perilaku (tahan / kembali sendiri). Ditulis di animation.js, nama posenya dari gesture_map.json. |
| Transisi | CSS: transition: transform <durasi>ms ease; transform-box: fill-box. Titik putar mengikuti pivot yang dibuat P2 di file SVG. |
| Sudut awal (tuning) | Angka di tabel Bab 3.4 adalah titik awal untuk dicoba, BUKAN angka final. Tanda +/- bisa terbalik tergantung arah gambar wayang dari P2 — sesuaikan sekali saat SVG asli datang, catat hasilnya. |
| Gerak kontinu satu-satunya | Gestur telunjuk: posisi kiri-kanan wayang mengikuti wrist_x, diratakan (posisi_baru = posisi_lama + 0,2 × (target − posisi_lama)) supaya tidak bergetar. Ada zona mati ±0,03 di tengah. |
| Balik arah (gestur ok) | Bukan animasi sekali jalan: ini saklar (toggle). grup-wayang diberi skala X −1 dan keadaan 'menghadap' disimpan di app.js sampai gestur ok berikutnya. |

### 3.4 Tabel Pose Awal per Gestur

| Gestur | Pose Target (sudut awal, derajat) | Durasi | Perilaku |
| --- | --- | --- | --- |
| (netral) | Semua layer 0 | 400 ms | Pose istirahat; ke sinilah wayang selalu kembali |
| telapak_terbuka | lengan-atas-kanan −110, lengan-bawah-kanan −20, lengan-atas-kiri +110, lengan-bawah-kiri +20 | 600 ms | Tahan selama gestur aktif |
| kepalan | Sama dengan netral | 500 ms | Perintah eksplisit kembali diam |
| telunjuk | lengan-atas-kanan −70, lengan-bawah-kanan 0; posisi panggung ikut wrist_x | 300 ms | Kontinu selama gestur aktif |
| dua_jari | lengan-atas-kanan −140, lengan-bawah-kanan −10 (tongkat menempel di lengan kanan, ikut bergerak) | 600 ms | Tahan selama gestur aktif |
| jempol | kepala +18, badan +12 | 800 ms | Tahan 1 detik, lalu kembali netral sendiri |
| ok | grup-wayang: skala X dibalik | 400 ms | Saklar arah (toggle) |

### 3.5 Aturan Main Frontend Saat Menerima Pesan

| Yang Diterima | Yang Dilakukan Frontend |
| --- | --- |
| state = ok, gestur BARU | Jalankan pose gestur itu (Bab 3.4); perbarui panel hasil bacaan. |
| state = ok, gestur SAMA seperti sekarang | Abaikan (jangan mulai ulang animasi), kecuali telunjuk: perbarui posisi panggung dari wrist_x. |
| state = unknown | Jangan ubah pose. Panel menampilkan 'ragu — tahan pose tangan sebentar'. |
| state = no_hand | Mulai hitung mundur 1 detik; bila tetap tidak ada tangan, kembali ke pose netral. |
| WebSocket putus | Status berubah "terputus", ws_client menyambung ulang otomatis tiap 2 detik; wayang diam di pose terakhir. |
| Confidence | Selalu tampilkan sebagai angka + batang di panel. Jangan pernah menyembunyikan confidence rendah — itu data untuk laporan. |

### 3.6 Mode Dummy dan Kontrol Demo

- **Sumber dummy ada dua, formatnya sama: **(a) dummy.js di frontend mengirim gestur palsu langsung ke mesin animasi; (b) backend tanpa model (Bab 2.5). Keduanya membuat P1 tidak pernah terblokir menunggu P2.
- **Tombol 6 gestur + tombol netral, plus keyboard: **tombol angka 1–6 = gestur sesuai urutan Bab 3 SDD, 0 = netral, D = buka/tutup panel dummy. Ini rencana cadangan utama saat demo bila kamera/model bermasalah di tempat.
- **Kontrol demo (di panel terlipat): **pilih model MLP/RF (kirim set_model), slider ambang confidence 0,40–0,90 (kirim set_threshold), tombol layar penuh untuk panggung.
## 4. Urutan Mengerjakan (Checklist P1)

| Urutan | Yang Dikerjakan | Selesai Kalau | Butuh P2? |
| --- | --- | --- | --- |
| 1 | Repo + config.py + app.py: GET / dan /api/health hidup | Halaman kosong terbuka di browser, health menjawab ok | Tidak |
| 2 | ws_client.js + backend kirim JSON contoh berkala | Panel hasil bacaan berubah mengikuti JSON contoh | Tidak |
| 3 | Mesin pose + dummy.js, pakai SVG kotak-kotak sederhana buatan sendiri sebagai wayang sementara | Ke-6 gestur bergerak dari tombol/keyboard | Tidak |
| 4 | camera.py + stream.py: /video_feed tampil di halaman | Webcam tampil real-time di kolom kamera | Tidak |
| 5 | hand_processor.py + panel.js: skeleton tampil, titik landmark digambar di frontend | Tangan bergerak → skeleton ikut, FPS terbaca | Tidak |
| 6 | features.py (samakan dengan P2) + smoother.py, uji tanpa model: tampilkan 63 angka di console/log | Angka fitur stabil saat tangan diam, berubah wajar saat pose berubah | Ya — sepakati features.py |
| 7 | model_service.py: pasang paket dari P2 (model + labels + gesture_map final) | Gestur asli menggerakkan wayang asli. Ini momen integrasi, bukan awal kerja | Ya — paket Bab 5 SDD |
| 8 | Pasang wayang.svg asli dari P2, sesuaikan tanda sudut Bab 3.4 sekali, uji demo penuh + tulis panduan | Demo jalan dari nol mengikuti panduan, termasuk mode dummy sebagai cadangan | Ya — SVG final |

***Kenapa begitu: ****Urutan ini sengaja menaruh dua barang dari P2 (model dan SVG) di dua langkah terakhir. Kalau keduanya terlambat, langkah 1–6 tetap selesai dan aplikasi tetap bisa didemokan dengan dummy — yang hilang hanya 'asli'-nya, bukan aplikasinya.*

## 5. Cara Menguji Bagian Ini

| Uji | Cara Cepat | Lolos Kalau |
| --- | --- | --- |
| Backend saja | Buka /api/health; sambungkan klien WebSocket sederhana (skrip/websocat) ke /ws/predict | Health benar; JSON masuk berkala dan formatnya persis Bab 2.3 |
| Frontend saja | Matikan backend model (atau jangan jalankan backend), pakai mode dummy | Semua pose Bab 3.4 bergerak benar dari tombol dan keyboard |
| Pipeline kamera | Tunjukkan tangan, gerakkan perlahan | Skeleton tidak tertinggal jauh dari tangan; FPS ≥ 12 di laptop demo |
| Anti-berkedip | Tahan satu pose 10 detik, lalu pose yang mirip (telapak_terbuka ↔ ok) | Wayang tidak ganti pose bolak-balik; panel menunjukkan majority vote bekerja |
| Cadangan demo | Cabut model (rename file), restart backend | Backend tetap hidup (mode tanpa model), dummy tetap bisa demo |
