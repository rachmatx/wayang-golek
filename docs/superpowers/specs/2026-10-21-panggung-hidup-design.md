# Panggung Hidup — Spesifikasi Alur Teatrikal

Tanggal: 2026-10-21
Status: disetujui arahnya, menunggu review spesifikasi

## 1. Tujuan

Membuat alur aplikasi wayang terasa seperti pertunjukan, bukan panel demo.
Wayang punya tingkah saat tidak ada tangan, bereaksi dengan dialog saat gestur
terbaca, lampu panggung berubah, dan ada suara gamelan sintetis. Tidak ada
skor, misi, atau cerita bercabang.

Non-tujuan:

- Tidak menambah karakter atau mengubah art wayang.
- Tidak mengubah model, backend, atau kontrak WebSocket.
- Tidak menambah paket npm atau aset audio/gambar biner.
- Tidak membuat mode cerita, tantangan berhitung, atau papan skor.

## 2. Prinsip

1. Panggung dominan; panel teknis jadi laci yang bisa dibuka.
2. Gestur yang sudah ada tetap jadi satu-satunya kendali wayang.
3. Semua reaksi teatrikal bersifat tambahan: kalau teater gagal dimuat,
   aplikasi tetap bisa memakai pose seperti sekarang.
4. Tanpa kamera/model, mode dummy tetap menghidupkan seluruh alur.
5. Gerak tambahan dihormati oleh `prefers-reduced-motion`; suara bisa dimatikan.

## 3. Istilah

- **Pembuka** — keadaan awal, tirai tertutup, wayang menunggu.
- **Live** — tirai terbuka, wayang bereaksi penuh.
- **Jeda** — tangan hilang; wayang bergoyang dan sesekali bicara.
- **Tidur** — tirai tutup, lampu padam; gestur apa pun membangunkan.
- **Balon** — gelembung dialog di atas panggung.
- **Cue** — satu paket reaksi: pose (sudah ada), dialog, warna lampu, efek suara.
- **Karakter** — Klasik, Arjuna, Gatotkaca, Cepot.

## 4. State machine

```
             gestur / tombol buka
   PEMBUKA ───────────────────────► LIVE
      ▲                               │  tangan hilang 2 dtk
      │ gestur (bangun)               ▼
   TIDUR ◄──── tangan hilang 90 dtk ─ JEDA
                                      │  gestur kembali
                                      └──► LIVE
```

| State | Masuk | Keluar | Perilaku |
| --- | --- | --- | --- |
| `pembuka` | boot, atau bangun dari tidur | gestur apa pun yang terbaca (`state === "ok"`), tombol Buka panggung; saat bangun, otomatis `live` setelah 2,5 dtk | tirai tertutup, lampu rendah, balon sambutan, kartu ajakan |
| `live` | pembuka selesai | tangan hilang ≥ 2 dtk | pose + cue penuh, event ambient berjalan |
| `jeda` | tidak ada tangan ≥ 2 dtk | gestur terdeteksi | goyangan idle, lampu turun 25%, balon acak tiap 8–14 dtk, tirai mulai turun di 45 dtk |
| `tidur` | tidak ada tangan ≥ 90 dtk | gestur apa pun | tirai penuh, lampu padam, audio ambient berhenti; gestur memicu pembuka singkat 2,5 dtk lalu otomatis `live` |

Aturan tambahan:

- `netral` (baik dari gestur maupun auto-reset setelah tangan hilang) tidak
  memicu dialog reaksi; hanya membuat wayang kembali ke pose netral.
- Perpindahan karakter boleh dari state mana pun. Di `live`/`jeda` mainkan
  keluar-masuk; di `pembuka`/`tidur` langsung ganti dan putar sambutan.
- Timer teater dijeda saat `document.hidden`. Saat kembali terlihat, timer
  dilanjutkan tanpa menumpuk event.
- `jeda` dan `tidur` hanya ditentukan oleh sinyal `no_hand` dari `app.js`.
  Teater tidak membaca kamera sendiri.

Batas waktu:

| Kejadian | Nilai |
| --- | --- |
| Pose kembali netral setelah tanpa tangan | 1.000 ms (perilaku lama) |
| Mulai idle | 2.000 ms |
| Balon idle pertama | 8.000 ms, lalu acak 10.000–14.000 ms |
| Event ambient | acak 20.000–40.000 ms |
| Tirai mulai turun | 45.000 ms |
| Tidur | 90.000 ms |
| Durasi balon | 3.500–4.500 ms |
| Jeda antar dialog | 2.500 ms |
| Buka tirai | 1.200 ms |
| Masuk/keluar karakter | 900 ms |

## 5. Skenario per babak

### 5.1 Pembuka

1. Halaman selesai memuat SVG. Tirai tertutup, lampu redup, latar kelir gelap.
2. Kartu di bawah tengah: "Tunjukkan telapak tangan" dengan tombol
   **Buka panggung**. Di bawahnya: "atau tekan D untuk mode dummy".
3. Wayang sudah berada di panggung dalam pose netral. Balon sambutan karakter
   muncul setelah 800 ms.
4. Pemicu buka: gestur apa pun yang terbaca (`state === "ok"`, bukan khusus
   gestur OK), klik tombol, atau sembarang angka 1–6 di mode dummy.
5. Saat terbuka: gong sintetis, lampu naik ke warna karakter, tirai membuka
   1,2 dtk, lalu balon Sambutan 2 dari naskah. Kalau dibuka lewat tombol
   (bukan gestur), wayang membungkuk singkat lewat `#grup-hidup` tanpa
   mengubah pose; kalau lewat gestur, pose gestur itu sudah diterapkan
   `app.js`.
6. Audio di-unlock pada klik atau tombol pertama; gestur kamera bukan
   interaksi browser, jadi kalau panggung dibuka murni oleh gestur sebelum
   ada klik, gong ditunda sampai klik/ketukan tombol pertama. Semua cue
   visual tetap jalan.

### 5.2 Live

- Setiap gestur baru yang terbaca (`state === "ok"`, termasuk dari mode dummy)
  memicu satu cue: pose yang sudah ada, balon, perubahan warna/intensitas
  lampu, dan efek suara.
- Gestur yang sama berturut-turut tidak memicu ulang (perilaku lama).
- `telunjuk` menggeser wayang seperti sekarang; sorot lampu mengikuti
  `wrist_x` dengan transisi 150 ms. `wrist_x` di luar 0,5 menggeser sorot ke
  sisi yang sama dengan arah geser wayang.
- `jempol` tetap auto-reset 1 dtk; balon setelah pose memakai baris `jempol`
  dari naskah.
- `ok` membalik panggung. Balon diposisikan ulang ke sisi hadap yang baru.
- Event ambient tiap 20–40 dtk: satu nada saron acak, kelip debu, atau
  ayunan bayangan. Maksimal satu event per 20 dtk.
- `kepalan` mengurangi opacity lampu 40% (jadi 60%) selama 1,5 dtk, lalu
  kembali.
- `telapak_terbuka` menaikkan lampu 20% selama 1,2 dtk.

### 5.3 Jeda

- Dipicu 2 dtk setelah `no_hand`.
- Wayang bergoyang halus (lihat 7.1). Lampu turun 25%.
- Balon pertama setelah 8 dtk, lalu acak 10–14 dtk, dipilih dari daftar idle.
- Di 45 dtk: tirai samping menutup 25% tiap sisi dan balon
  "Dalang… masih di sana?" muncul sekali.
- Gestur apa pun: batalkan jeda, kembalikan lampu, balon bangun, lalu cue
  gestur tersebut dijalankan.

### 5.4 Tidur

- Dipicu 90 dtk tanpa gestur.
- Tirai menutup penuh 1,2 dtk, lampu padam, ambient berhenti.
- Overlay tipis: "Panggung istirahat — tunjukkan tangan untuk membangunkan."
- Gestur apa pun memulai pembuka singkat: tirai buka 1,2 dtk, lampu naik,
  balon bangun, lalu otomatis `live` tanpa perlu gestur kedua.

### 5.5 Ganti karakter

- Tombol tray "Pemain" selalu tersedia.
- Saat karakter dipilih, `app.js` memanggil `Teater.exitCharacter()` dan
  menunggu promise-nya (900 ms). Teater memutar `#grup-hidup` ke 4° (bungkuk)
  dan memudarkan wayang ke opacity 0; tidak mengubah pose.
- Setelah itu `app.js` memuat SVG baru seperti sekarang, lalu memanggil
  `Teater.setCharacter(key)`.
- Wayang baru masuk dari sisi berlawanan arah hadap: `translateX(-40px)` bila
  menghadap kanan, `translateX(40px)` bila menghadap kiri, plus fade in
  900 ms. Warna lampu berganti ke warna karakter, lalu balon `Masuk`.
- State tidak berubah (`live` tetap `live`). Scheduler idle/ambient dijeda
  selama 1,8 dtk transisi, lalu dilanjutkan.
- Kalau pengguna menekan karakter lain saat transisi berjalan, tombol
  diabaikan sampai 900 ms selesai (penjaga `app.characterLoading` yang ada
  tetap dipakai).

### 5.6 Koneksi dan kegagalan

| Kejadian | Perilaku |
| --- | --- |
| WebSocket terputus | Tirai tetap terbuka, wayang diam di pose terakhir, pita tipis di atas panggung "dalang terputus — aku menunggu", balon tidak dipicu |
| WebSocket tersambung lagi | Pita hilang, balon "Kita lanjut, dalang." |
| Kamera mati | Inset menampilkan `kamera-off.svg`; teater tetap jalan lewat dummy |
| Model belum ada | Pembuka tetap bisa dibuka; kartu menampilkan petunjuk mode dummy |
| SVG wayang gagal dimuat | Tetap di pembuka, kartu berubah jadi pesan galat; tombol buka nonaktif |
| Audio diblokir | Semua cue visual tetap jalan; ikon suara menunjukkan mati |
| Tab disembunyikan | Timer dan audio ambient dijeda; tidak ada ledakan event saat kembali |
| Gestur beruntun < 2,5 dtk | Cue berikutnya hanya mengganti balon, tanpa menumpuk |

## 6. Naskah dialog

Gaya: Indonesia santai dengan sisipan Jawa. Satu balon maksimal 70 karakter.
Data disimpan di `frontend/js/dialog.js` sebagai `window.Dialog`. Baris gestur
punya dua varian; baris suasana punya satu atau lebih. Varian dipilih acak
tanpa mengulang varian terakhir untuk karakter yang sama.

### 6.1 Baris gestur

| Gestur | Klasik | Arjuna | Gatotkaca | Cepot |
| --- | --- | --- | --- | --- |
| `telapak_terbuka` | "Tangan terbuka, panggung pun terbuka." | "Lebar tanganmu, lebar pula langkahku." | "Buka selebar-lebarnya! Aku siap!" | "Wih, tangannya lebar. Mau pelukin aku, ya?" |
| `kepalan` | "Sudah cukup. Kita diam sejenak." | "Keteguhan hati, bukan kekerasan." | "Kepalan? Kekuatanku menahan diri." | "Aku dikepal? Aku wayang, bukan sambel." |
| `telunjuk` | "Ke mana pun kau tunjuk, aku ikut." | "Arahmu adalah arahku." | "Tunjuk saja! Aku terjang!" | "Tunjuk terus. Nanti aku kesasar." |
| `dua_jari` | "Dua jari, satu langkah kecil." | "Dua jari, sehalus gerak angsa." | "Dua jari! Siap perang!" | "Dua jari doang? Aku kira mau traktir." |
| `jempol` | "Matur nuwun, dalang." | "Terima kasih, dalang budiman." | "Bagus! Kau punya selera!" | "Nah, gitu dong! Matur nuwun." |
| `ok` | "Dunia berputar. Kita hadapi lagi." | "Berbalik arah pun tetap anggun." | "Berbalik? Hah, lawan di mana?" | "Lho, kok malah mbalik? Malu-maluin." |

Varian kedua:

| Gestur | Klasik | Arjuna | Gatotkaca | Cepot |
| --- | --- | --- | --- | --- |
| `telapak_terbuka` | "Lengan ini terbuka untukmu." | "Angin menyentuh kedua tanganku." | "HAH! Tenagaku penuh!" | "Pelukannya jangan terlalu kuat, ya." |
| `kepalan` | "Tenang. Panggung masih milik kita." | "Diam pun bagian dari tari." | "Kepalan ini kutahan dulu." | "Jangan dikepal terus, nanti aku gepeng." |
| `telunjuk` | "Arahkan, aku mengikuti." | "Jari itu seperti panah yang tenang." | "Mana lawannya? Aku siap!" | "Jangan tunjuk aku terus, aku malu." |
| `dua_jari` | "Dua jari, dua langkah." | "Gemulai, bukan lemah." | "Dua jari pun cukup untuk menantang!" | "Dua jari? Aku kira dua ribu." |
| `jempol` | "Terima kasih, dalang." | "Budi baikmu kucatat." | "Jempolmu kecil, semangatmu besar!" | "Iya, iya, aku memang hebat." |
| `ok` | "Kita berbalik dengan tenang." | "Sisi lain pun indah." | "Berbalik! Siap hadapi apa pun!" | "Muter-muter kayak gasing." |

### 6.2 Baris suasana

| Event | Klasik | Arjuna | Gatotkaca | Cepot |
| --- | --- | --- | --- | --- |
| Sambutan | "Sugeng rawuh, dalang. Panggung siap." | "Sugeng rawuh. Lengan ini siap menari." | "HAH! Panggung sudah siap, dalang!" | "Lho, dalang datang! Aku belum mandi." |
| Sambutan 2 | "Mari kita mulai." | "Mari menari bersama." | "Ayo, jangan lama-lama!" | "Ayo mulai, aku udah nggak sabar." |
| Bangun | "Oh, kau kembali. Mari lanjut." | "Kau kembali. Panggung terasa hidup." | "Akhirnya! Aku hampir bosan." | "Eh, dalang! Aku kira kau kabur." |
| Tidur | "Aku istirahat dulu, dalang." | "Selamat malam, dalang." | "Aku tidur. Bangunkan kalau ada perang." | "Aku tidur dulu. Jangan diganggu, ya." |
| Masuk | "Aku mengambil panggung sebentar." | "Izinkan aku tampil." | "Panggung ini butuh otot!" | "Aku datang, bawa becanda." |
| Keluar | "Panggung kuserahkan." | "Aku undur diri dengan hormat." | "Aku pergi dulu. Panggil kalau perlu." | "Aku pergi dulu. Jangan kangen." |
| Sambung lagi | "Kita lanjut, dalang." | "Kita lanjut, dalang." | "Kita lanjut, dalang." | "Kita lanjut, dalang." |
| Idle 1 | "Sepi, ya…" | "Senja ini tenang…" | "Ototku bergetar!" | "Dalang, ada makanan?" |
| Idle 2 | "Dalang, aku masih di sini." | "Dalang, jangan jauh-jauh." | "Dalang, ada lawan?" | "Aku bosan. Ajak aku ngobrol." |
| Idle 3 | "Angin malam ini dingin." | "Dengarkan gamelan di kejauhan." | "Aku belum berkeringat." | "Jangan tidur, nanti aku kesepian." |
| Balon 45 dtk | "Dalang… masih di sana?" | "Dalang… masih di sana?" | "Dalang… masih di sana?" | "Dalang… masih di sana?" |

## 7. Tampilan dan gerak

### 7.1 Gerak hidup

`animation.js` menambahkan satu pembungkus lagi di dalam `#grup-arah`:

```
#grup-posisi > #grup-arah > #grup-hidup > #grup-wayang
```

`#grup-hidup` dipakai khusus untuk idle supaya tidak bentrok dengan transform
pose milik `#grup-wayang` dan transform geser milik `#grup-posisi`.

- Idle: `rotate(-0,6deg)` ke `rotate(0,6deg)` selama 4 dtk, `ease-in-out`,
  bolak-balik, ditambah `translateY` 1,5 px. Transform-origin di kaki
  (63% lebar, 88% tinggi viewBox), sama dengan pivot bungkuk.
- `#grup-hidup` hanya punya satu peran pada satu waktu: kelas `idle`,
  `keluar`, atau `masuk`. Ketiganya tidak boleh aktif bersamaan.
- Saat gestur/cue masuk, kelas `idle` dilepas; wayang berhenti bergoyang
  dalam 400 ms.
- Saat `prefers-reduced-motion: reduce`, goyangan dihilangkan sama sekali;
  wayang tetap diam dan hanya lampu/balon yang berubah.

### 7.2 Tata letak

```
┌──────────────────────────────────────────────────────┐
│ brand ·············· status koneksi   [?] [🔊] [⛶]  │
│ ┌──────────────────────────────────────────────────┐ │
│ │                    KELIR                         │ │
│ │   [balon dialog]                    wayang       │ │
│ │                                                  │ │
│ │  ┌────────────┐                    ┌───────────┐ │ │
│ │  │ booth      │                    │ Info demo │ │ │
│ │  │ dalang cam │                    │  (laci)   │ │ │
│ │  └────────────┘                    └───────────┘ │ │
│ └──────────────────────────────────────────────────┘ │
│        Pemain: [Klasik] [Arjuna] [Gatotkaca] [Cepot] │
└──────────────────────────────────────────────────────┘
```

- Panggung mengisi sisa tinggi viewport; rasio kelir tetap mendekati 4:5,
  wayang memakai tinggi 88% kelir seperti sekarang.
- Kamera inset: lebar `clamp(150px, 18vw, 220px)`, rasio 4:3, di kiri bawah
  panggung, bingkai emas tipis, label "booth dalang". `<img id="video-feed">`
  dan `<canvas id="skeleton">` dipindah ke sini; ID tidak berubah.
- Laci teknis: lebar 360 px, dari kanan, menutup panggung sebagian. Isi:
  status, hasil bacaan, keyakinan, top-3, model, FPS, ambang, pemilih model,
  dan tombol mode dummy. ID panel lama dipertahankan supaya `panel.js` tidak
  perlu diubah.
- Tray pemain di bawah panggung. Tombol karakter memakai `data-wayang` yang
  sudah ada.
- Label pose/arah lama (`#panggung-pose`, `#panggung-arah`) tetap ada sebagai
  teks kecil di kanan bawah panggung, berguna saat demo.
- Footer lama dibongkar: panduan pindah ke overlay "?", kontrol model/ambang/
  dummy pindah ke laci, tombol layar penuh pindah ke bar atas panggung.
- Panduan gestur dibuka lewat tombol "?" sebagai overlay di atas panggung,
  memakai `#panduan-isi` yang dibangun `buildPanduan()`.
- Tombol suara `aria-pressed`, ikon berubah antara nyala dan mati.
- Pembuka memakai kartu di bawah tengah panggung, bukan modal penuh layar.

### 7.3 Lampu dan panggung

- Variabel `--lampu-warna` di elemen panggung, diatur lewat `data-karakter`:
  - Klasik `#e8b866`
  - Arjuna `#8fbf7a`
  - Gatotkaca `#6fa8dc`
  - Cepot `#e07a5f`
- Lapisan `.lampu`: dua radial-gradient (sorot utama di tengah belakang wayang
  dan sorot kaki). Opacity berubah 1,2 dtk saat cue.
- Sorot telunjuk: posisi horizontal sorot mengikuti `--sorot-x` 20–80%,
  transisi 150 ms.
- Tirai: dua panel samping dengan gradasi beludru dan rumbai. Tertutup penuh
  di pembuka/tidur, membuka 1,2 dtk, dan tiap sisi menutup 25% saat jeda
  45 dtk.
- Debu: maksimal 12 titik, animasi `transform`/`opacity`, 10–18 dtk,
  disembunyikan saat reduced motion.
- Bayangan wayang: satu ellipse SVG blur (lebar 120, tinggi 16, cx 63% lebar,
  cy 88% tinggi viewBox) disisipkan di `#grup-posisi` sebelum `#grup-arah`,
  jadi ikut bergeser horizontal tanpa JS tambahan.
- Balon dialog: HTML di atas kelir, latar gelap keemasan, teks terang,
  muncul 200 ms, hilang 300 ms. Posisi sisi kanan atas wayang; saat
  menghadap kiri, pindah ke kiri. `aria-live="polite"`.
- Semua efek hanya memakai `transform` dan `opacity`.

## 8. Suara sintetis

Modul `frontend/js/audio.js`, diekspos sebagai `window.Suara` (jangan pakai
nama `Audio` karena bentrok dengan konstruktor browser).

| Cue | Komposisi | Durasi | Volume |
| --- | --- | --- | --- |
| Buka panggung | gong 70 Hz + overtone 140 Hz | 2,4 dtk | 0,25 |
| Telapak | saron naik 3 nada (523, 659, 784 Hz) | 0,9 dtk | 0,12 |
| Kepalan | kendang rendah (noise lowpass 180 Hz) | 0,2 dtk | 0,16 |
| Telunjuk | klik halus 900 Hz saat arah berubah > 0,08, maksimal tiap 400 ms | 0,05 dtk | 0,05 |
| Dua jari | dua nada saron (587, 880 Hz) | 0,5 dtk | 0,12 |
| Jempol | gong kecil + tepuk (noise burst) | 1,2 dtk | 0,14 |
| OK | saron turun (784, 659, 523 Hz) + swish | 0,8 dtk | 0,12 |
| Ambient | drone 55 Hz sangat pelan | berkelanjutan | 0,03 |
| Tidur | gong turun 98 → 65 Hz | 2,0 dtk | 0,18 |

Aturan:

- AudioContext dibuat setelah klik, ketukan tombol, atau tekanan keyboard
  pertama, lalu `resume()`. Gestur kamera tidak dihitung sebagai interaksi
  browser.
- Semua node dibuat ulang per cue dan diputus setelah selesai; tidak ada
  node menumpuk.
- Tombol suara menyimpan pilihan di `localStorage` kunci
  `wayang-suara` (`"nyala"`/`"mati"`). Bawaannya `"nyala"`.
- Ambient hanya berbunyi di `live` dan `jeda`, berhenti di `pembuka`/`tidur`
  dan saat tab disembunyikan.
- Tidak ada musik latar berupa melodi panjang; hanya drone dan nada acak.

## 9. Arsitektur modul

| Berkas | Peran |
| --- | --- |
| `frontend/js/theater-core.js` | state machine murni + pemilih dialog + jadwal ambient; tanpa DOM, bisa diuji Node |
| `frontend/js/theater.js` | DOM glue: tirai, lampu, balon, timer, event listener, integrasi karakter |
| `frontend/js/dialog.js` | data naskah `window.Dialog` |
| `frontend/js/audio.js` | synth WebAudio `window.Suara` |
| `frontend/js/app.js` | memancarkan event gestur, tangan, wrist, dan koneksi |
| `frontend/js/animation.js` | menambah `#grup-hidup` dan bayangan panggung |
| `frontend/index.html` | tata letak teater, inset kamera, laci, tray, overlay |
| `frontend/css/style.css` | lapisan panggung, tirai, lampu, balon, laci, responsif |

Kontrak event dari `app.js`:

```js
document.dispatchEvent(new CustomEvent("wayang:gesture", {
  detail: { gesture: "dua_jari", source: "live", confidence: 0.92 }
}));
document.dispatchEvent(new CustomEvent("wayang:nohand"));
document.dispatchEvent(new CustomEvent("wayang:hand"));
document.dispatchEvent(new CustomEvent("wayang:wrist", { detail: { x: 0.54 } }));
document.dispatchEvent(new CustomEvent("wayang:connection", { detail: { state: "connected" } }));
```

- `wayang:gesture` dipancarkan di `activateGesture()` setelah pose diterapkan,
  termasuk dari mode dummy. Teater mengabaikan `netral`.
- `wayang:nohand` dipancarkan sekali saat prediksi berubah dari ada tangan
  menjadi `no_hand`. `wayang:hand` dipancarkan sekali saat tangan terdeteksi
  lagi. Keduanya dipakai teater untuk timer jeda dan tidur; teater tidak
  memakai timer sendiri per pesan kamera.
- `wayang:wrist` dipancarkan setiap `setWrist()` dipanggil dengan nilai valid.
- Teater tidak memanggil `Wayang.applyPose`; pose tetap milik `app.js`.

API `window.Teater`:

```js
Teater.init({ root: document.getElementById("panggung") });
Teater.exitCharacter();          // Promise, selesai setelah animasi keluar 900 ms
Teater.setCharacter("cepot");    // dipanggil setelah SVG baru termuat
Teater.state();                  // "pembuka" | "live" | "jeda" | "tidur"
Teater.setSound(true);           // dipanggil tombol suara
```

`Teater.init` idempoten; kalau elemen teater tidak ada, init gagal diam-diam
dan aplikasi tetap berjalan dengan pose lama. `app.js` memanggil `Teater`
hanya bila `window.Teater` ada, sehingga kalau `theater.js` gagal dimuat
pose dan panel lama tetap jalan.

Urutan `<script>` di `index.html`:

```
ws_client.js → animation.js → panel.js → dummy.js →
dialog.js → audio.js → theater-core.js → theater.js → app.js
```

`theater-core.js` harus termuat sebelum `theater.js`; `app.js` terakhir karena
memanggil `Teater.init()` saat boot.

## 10. Pengujian

### 10.1 Uji logika (Node, tanpa dependensi baru)

Berkas: `frontend/tools/test_theater.mjs`, dijalankan
`node --test frontend/tools/test_theater.mjs`.

`theater-core.js` memakai pola UMD:

```js
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TeaterCore = api;
```

Kasus uji:

1. `pembuka` + gestur terbaca (mis. `telapak_terbuka`) → `live` dan efek
   `buka-tirai`.
2. `live` + `no_hand` ≥ 2 dtk → `jeda`.
3. `jeda` + gestur → `live`, balon bangun.
4. `jeda` + 90 dtk tanpa gestur → `tidur`, ambient berhenti.
5. `tidur` + gestur → `pembuka`; core memberi efek `buka-singkat`, dan glue
   memindahkan state ke `live` setelah 2,5 dtk.
6. Gestur `netral` tidak menghasilkan balon reaksi.
7. Dua gestur sama berturut-turut tidak memicu dua cue.
8. Pemilih dialog tidak mengulang varian terakhir.
9. Cooldown 2,5 dtk menahan balon kedua.
10. Ganti karakter saat transisi berjalan diabaikan.
11. Core menolak menjadwalkan ambient bila flag `hidden` aktif.
12. Ambient tidak pernah dijadwalkan kurang dari 20 dtk dari event sebelumnya.
13. Permintaan ganti karakter saat transisi aktif tidak mengubah state dan
    tidak memotong transisi yang sedang berjalan.

### 10.2 Uji browser

1. Jalankan backend, buka `http://127.0.0.1:8000`.
2. Tanpa kamera: tekan D, lalu 1–6. Setiap gestur harus memicu pose, balon,
   lampu, dan suara (setelah klik pertama).
3. Biarkan 20 dtk: idle sway dan balon suasana muncul.
4. Biarkan 45 dtk: tirai mulai turun.
5. Biarkan 90 dtk: tidur; tekan angka apa pun untuk bangun.
6. Ganti keempat karakter: warna lampu, naskah, dan transisi masuk/keluar.
7. Buka laci Info demo: FPS, top-3, model, ambang, dan skeleton tetap bekerja.
8. Matikan suara, reload: pilihan tetap mati.
9. Emulasi `prefers-reduced-motion: reduce`: tidak ada goyangan/debu; alur
   tetap berjalan.
10. Cek konsol: tidak ada error.
11. Screenshot tiap state pada viewport 1440×900 dan 1024×768.

### 10.3 Uji manual

- Suara gamelan terdengar wajar dan tidak pecah pada volume perangkat normal.
- Balon tidak menutupi wajah wayang.
- Di mesin dengan kamera normal, gestur cepat tidak membuat balon berkedip.
  Mesin pengembangan ini mengirim layar biru, jadi uji ini dilakukan di
  mesin demo.

## 11. Aksesibilitas

- Keyboard 1–6, 0, dan D tetap bekerja seperti sekarang.
- Semua tombol baru punya label teks atau `aria-label`, dan `:focus-visible`.
- Balon memakai `aria-live="polite"`; pembaruan cepat dibatasi cooldown.
- Tombol suara memakai `aria-pressed="true|false"`.
- Tirai dan debu `aria-hidden="true"`.
- Kontras teks balon minimal 4,5:1 terhadap latar.
- `prefers-reduced-motion` menghilangkan goyangan, debu, dan transisi tirai
  berbasis gerak (diganti fade).

## 12. Kinerja

- Maksimal 12 partikel debu; tidak ada canvas tambahan.
- Hanya `transform` dan `opacity` yang dianimasikan.
- Satu timer scheduler untuk teater; bukan interval per efek.
- Timer berhenti saat tab tersembunyi.
- Ukuran tambahan halaman: di bawah 25 KB JS/CSS sebelum gzip.

## 13. Urutan pengerjaan

1. **Kerangka teater** — tata letak baru, tirai, inset kamera, laci teknis,
   tray pemain, overlay pembuka. Pose dan panel lama tetap jalan.
2. **Hidup** — `#grup-hidup`, idle, balon, naskah, lampu, event gestur.
3. **Suara dan babak** — synth WebAudio, tidur/bangun, transisi karakter,
   ambient, reduced motion.
4. **Verifikasi** — uji Node, dummy semua gestur, screenshot tiap state,
   pembaruan README bagian kontrol demo.

Setiap langkah harus meninggalkan aplikasi yang bisa didemokan.
