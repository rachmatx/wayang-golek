# Panggung Hidup — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah alur aplikasi wayang menjadi pertunjukan teatrikal (Pembuka → Live → Jeda → Tidur) dengan dialog, lampu, tirai, suara sintetis, dan transisi karakter — tanpa mengubah model, backend, atau kontrak WebSocket.

**Architecture:** Lapisan teater baru di frontend. `theater-core.js` adalah state machine murni berbasis `tick(now)` yang mengembalikan daftar efek; `theater.js` adalah DOM glue yang mengeksekusi efek (tirai, lampu, balon, suara, transisi karakter); `dialog.js` menyimpan naskah; `audio.js` menyintesis suara lewat WebAudio. `app.js` tetap pemilik pose dan memancarkan event `wayang:*`. `animation.js` menambah pembungkus `#grup-hidup` dan bayangan SVG.

**Tech Stack:** Vanilla JS (IIFE/UMD), CSS, WebAudio API, Node `node:test` (tanpa dependensi baru), FastAPI backend yang sudah ada (tidak diubah).

**Spec:** `docs/superpowers/specs/2026-10-21-panggung-hidup-design.md`

## Global Constraints

- Tidak menambah paket npm, aset audio, atau gambar biner baru.
- Tidak mengubah backend, `shared/gesture_map.json`, `frontend/js/panel.js`, `frontend/js/dummy.js`, `frontend/js/ws_client.js`.
- Kontrak WebSocket dan perilaku pose yang ada tidak berubah; teater hanya menambah reaksi.
- Tanpa kamera/model, seluruh alur harus hidup lewat mode dummy (tombol 1–6, 0, D).
- Semua efek visual hanya `transform` dan `opacity`; hormati `prefers-reduced-motion`.
- Audio hanya dimulai setelah interaksi pengguna nyata (klik/tombol); gestur kamera bukan interaksi browser.
- Repo ini bukan git repository: jangan `git init`. Setiap task diakhiri checkpoint verifikasi, bukan commit.
- Bahasa UI dan dialog: Indonesia santai dengan sisipan Jawa.

## Timing (ms)

| Kejadian | Nilai |
| --- | --- |
| Reset netral setelah tanpa tangan | 1000 |
| Masuk jeda | 2000 |
| Balon idle pertama | 8000, lalu 10000–14000 |
| Ambient | 20000–40000 |
| Tirai setengah | 45000 |
| Tidur | 90000 |
| Durasi balon | 3500–4500 |
| Jeda antar-cue | 2500 |
| Buka tirai | 1200 |
| Tukar karakter | 900 |
| Pembuka bangun | 2500 |

## Efek (kosakata `theater-core`)

```js
{ type: "curtain", open: true|false, half?: true }   // tirai
{ type: "light", level: "low"|"full"|"idle"|"off"|"dim"|"bright" }
{ type: "bubble", text, ms?, delay? }                // balon dialog
{ type: "idle", on: true|false }                     // goyangan #grup-hidup
{ type: "sound", cue: "buka"|"telapak"|"kepalan"|"dua_jari"|"jempol"|"ok"|"tidur" }
{ type: "ambient" }                                  // teater pilih saron/debu/bayangan
{ type: "bow" }                                      // bungkuk singkat saat buka via tombol
{ type: "exit-character" } | { type: "enter-character", character }
{ type: "ribbon", visible: true|false }              // pita "dalang terputus"
{ type: "character", key }                           // warna lampu + data-karakter
```

## File Structure

| Berkas | Aksi | Tanggung jawab |
| --- | --- | --- |
| `frontend/index.html` | ubah | tata letak teater, laci, tray, overlay panduan |
| `frontend/css/teater.css` | buat | panggung, tirai, lampu, balon, inset, laci, tray, responsif |
| `frontend/js/theater-core.js` | buat | state machine murni + pemilih dialog + jadwal |
| `frontend/tools/test_theater.mjs` | buat | uji Node untuk core dan dialog |
| `frontend/js/dialog.js` | buat | `window.Dialog` (naskah) |
| `frontend/js/audio.js` | buat | `window.Suara` synth WebAudio |
| `frontend/js/theater.js` | buat | DOM glue + API `window.Teater` |
| `frontend/js/animation.js` | ubah | `#grup-hidup` + `#bayangan-wayang` |
| `frontend/js/app.js` | ubah | event `wayang:*`, pita koneksi, transisi karakter |
| `README.md` | ubah | struktur, kontrol, alur, uji |

Script order di `index.html`:
`ws_client.js → animation.js → panel.js → dummy.js → dialog.js → audio.js → theater-core.js → theater.js → app.js`

---

### Task 1: Cangkang teater (HTML + CSS + chrome)

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/css/teater.css`
- Create: `frontend/js/theater.js` (hanya chrome: laci, panduan, suara, buka, fullscreen)
- Modify: `frontend/js/app.js` (bind fullscreen pindah ke `theater.js`, lihat Task 4)

**Interfaces:**
- Produces: ID `#panggung`, `#kelir`, `#tirai-kiri`, `#tirai-kanan`, `#lampu`, `#debu`, `#balon`, `#pita-terputus`, `#inset-dalang`, `#pembuka-kartu`, `#tombol-buka`, `#tombol-laci`, `#tombol-panduan`, `#tombol-suara`, `#tombol-fullscreen`, `#laci-teknis`, `#laci-tutup`, `#panduan-overlay`, `#panduan-tutup`; semua ID panel lama dipertahankan.
- Produces: `window.Teater.setSound`, `Teater.init`, `Teater.setCharacter`, `Teater.exitCharacter`, `Teater.isBusy`, `Teater.fail` (stub di task ini, diisi Task 5).

- [ ] **Step 1:** Tulis ulang `index.html` dengan struktur: topbar (brand, status, ?, suara, fullscreen, Info demo), `<main class="panggung-wrap">` berisi `section#panggung` (kelir, lampu, debu, tirai, balon, pita, inset dalang, kaki panggung, kartu pembuka, badge dummy) + `div.tray#kontrol-wayang`, lalu `aside#laci-teknis` (hasil bacaan + model/ambang/dummy), backdrop laci, overlay panduan, panel dummy. Hapus `.layout` dan `.footer` lama.
- [ ] **Step 2:** Buat `teater.css`: `.app` tetap flex column; `.panggung-wrap` grid center; `.panggung` rasio 4:5, tinggi maksimum sisa viewport; kelir penuh; tirai dua panel beludru dengan rumbai; `.lampu` dua radial-gradient memakai `--lampu-warna`; `.balon` kanan/kiri atas mengikuti `data-arah`; `.debu` 12 titik; inset kamera `clamp(150px,18vw,220px)` kiri bawah; kartu pembuka bawah tengah; tray karakter; laci 360px dari kanan + backdrop; overlay panduan; responsif ≤1080px dan ≤760px; `prefers-reduced-motion`.
- [ ] **Step 3:** Buat `theater.js` dengan chrome: buka/tutup laci, buka/tutup panduan, tombol suara (`aria-pressed`, `localStorage["wayang-suara"]`), tombol buka panggung memanggil `core.open("button")` bila core ada (stub aman), fullscreen memakai `#panggung`.
- [ ] **Step 4:** Verifikasi browser (backend `run.bat`): halaman tampil tanpa error konsol, laci terbuka/tertutup, panduan berisi 6 gestur, tombol suara mengubah ikon, inset kamera tampil, tray karakter ada.
- [ ] **Step 5:** Checkpoint — `node --check frontend/js/theater.js`.

---

### Task 2: `theater-core.js` + tes (TDD)

**Files:**
- Create: `frontend/tools/test_theater.mjs`
- Create: `frontend/js/theater-core.js`

**Interfaces:**
- Produces: `window.TeaterCore` / `module.exports` dengan `create(options)`.
- `options`: `{ dialog, random = Math.random }`.
- `core.init({ character })`, `core.open(source)`, `core.gesture({ gesture, confidence })`, `core.noHand()`, `core.hand()`, `core.tick(now)`, `core.setCharacter(key)`, `core.exitCharacter()`, `core.enterCharacter()`, `core.connection(state)`, `core.setSound(on)`, `core.shift(ms)`, `core.state()`, `core.snapshot()`.
- Setiap mutasi mengembalikan `{ state, effects }`; `tick` mengembalikan `{ effects }`.
- `core.state()` → `"pembuka" | "live" | "jeda" | "tidur"`.

**Aturan inti:**
- `init` → `pembuka`, efek `{type:"curtain",open:false}`, `{type:"light",level:"low"}`, `{type:"idle",on:false}`; balon sambutan dijadwalkan 800 ms lewat tick.
- `open` dari `pembuka` → `live`; efek buka tirai, lampu `full`, gong (`sound:buka`), balon `sambutan2`; `source==="button"` menambah `{type:"bow"}`.
- `gesture` di `pembuka` (selain `netral`) membuka panggung lebih dulu lalu memproses cue; di `live` cue = balon + suara + lampu; duplikat gestur sama berturut-turut diabaikan; `netral` tidak memicu cue.
- Cooldown 2500 ms: cue dalam cooldown hanya mengganti balon.
- `noHand` mencatat waktu; tick +2000 ms → `jeda` (idle on, lampu idle). Balon idle pertama +8000, berikutnya 10000–14000. +45000 tirai setengah + balon `half` sekali. +90000 → `tidur` (tirai tutup, lampu off, idle off, sound tidur, balon tidur).
- `gesture` di `jeda`/`tidur`: `jeda` → `live` + balon `bangun` (delay 0) lalu cue (delay 900); `tidur` → `pembuka` dengan auto-open pada +2500 ms, efek tirai buka, lampu naik, balon `bangun`.
- `handle` masuk → batalkan jeda; kembali ke `live` bila state `jeda`.
- `connection("disconnected")` → pita tampil, cue dibungkam; `"connected"` → pita hilang + balon `sambung` bila state live/jeda.
- `exitCharacter()` → `busySwap=true`, efek `exit-character`; selama busy, gesture/open/karakter diabaikan. `enterCharacter()` → `busySwap=false`, efek `enter-character` + balon `masuk` + efek karakter.
- `shift(ms)` menggeser semua waktu absolut (stateSince, nextIdleAt, nextAmbientAt, curtainAt, sleepAt, bubbleUntil, wakeAt) — dipakai saat tab tersembunyi.
- Ambient: di `live`/`jeda`, jadwal awal +20000, ulang acak 20000–40000; satu efek per jadwal.

- [ ] **Step 1:** Tulis `frontend/tools/test_theater.mjs` dengan `node:test` + `assert/strict`, memakai dialog tiruan:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const TeaterCore = require("../js/theater-core.js");

const dialog = {
  gestur: {
    telapak_terbuka: ["A1", "A2"], kepalan: ["B1", "B2"], telunjuk: ["C1", "C2"],
    dua_jari: ["D1", "D2"], jempol: ["E1", "E2"], ok: ["F1", "F2"],
  },
  suasana: {
    sambutan: ["S1"], sambutan2: ["S2"], bangun: ["B"], tidur: ["T"],
    masuk: ["M"], keluar: ["K"], sambung: ["L"], idle: ["I1", "I2", "I3"],
    half: ["H"],
  },
};
function make(seed = 0) {
  let n = seed;
  const core = TeaterCore.create({ dialog, random: () => (n = (n + 0.13) % 1) });
  core.init({ character: "klasik" });
  return core;
}
```

Kasus (semua harus gagal dulu sebelum implementasi):
1. `init` → `pembuka` + tirai tertutup.
2. `open("gesture")` → `live`, efek tirai buka + `sound:buka`; tanpa `bow`.
3. `open("button")` → ada efek `bow`.
4. `tick(800)` di pembuka → balon `sambutan`.
5. `noHand()` lalu `tick(1999)` tetap `live`, `tick(2000)` → `jeda`.
6. `jeda` + `gesture` → `live`, balon `bangun` lalu cue dengan `delay:900`.
7. `jeda` + `tick(45000)` → tirai setengah + balon `half` (sekali saja).
8. `jeda` + `tick(90000)` → `tidur` + `sound:tidur` + lampu off.
9. `tidur` + gestur → `pembuka`, `tick(+2500)` → `live` otomatis.
10. Gestur `netral` tidak memicu balon/suara.
11. Gestur sama dua kali → cue kedua kosong (kecuali balon tidak berubah).
12. Cooldown: dua gestur berbeda dalam <2500 ms → cue kedua hanya `bubble`.
13. Varian dialog bergantian (tidak mengulang varian terakhir).
14. `exitCharacter` mengunci; `gesture`/`open` diabaikan; `enterCharacter` melepas.
15. `connection("disconnected")` → pita tampil + cue dibungkam; `connected` → pita hilang.
16. `shift(60000)` menunda tidur 60 detik.
17. Ambient muncul dalam 20000–40000 dan tidak lebih awal.

- [ ] **Step 2:** Jalankan `node --test frontend/tools/test_theater.mjs`, pastikan gagal karena modul belum ada.
- [ ] **Step 3:** Implementasikan `theater-core.js` (UMD, tanpa DOM). Semua waktu absolut dari argumen `tick(now)`; jangan pakai `Date.now()` internal.
- [ ] **Step 4:** Jalankan tes sampai hijau.
- [ ] **Step 5:** Checkpoint — `node --check frontend/js/theater-core.js`.

---

### Task 3: Naskah dan suara

**Files:**
- Create: `frontend/js/dialog.js`
- Create: `frontend/js/audio.js`
- Modify: `frontend/tools/test_theater.mjs` (tes bentuk dialog)

**Interfaces:**
- `window.Dialog = { gestur: { <id>: [varian1, varian2] }, suasana: { sambutan:[], sambutan2:[], bangun:[], tidur:[], masuk:[], keluar:[], sambung:[], idle:[], half:[] }, label: { <key>: <label> } }`
- `window.Suara = { unlock(), setEnabled(on), enabled(), play(cue), ambient(on), isUnlocked() }`

- [ ] **Step 1:** Tulis tes: setiap gestur punya ≥2 varian, setiap suasana punya ≥1 baris, semua baris ≤70 karakter, `sambung` ada.
- [ ] **Step 2:** Jalankan, pastikan gagal.
- [ ] **Step 3:** Isi `dialog.js` persis dari spec §6.1–6.2 (4 karakter: Klasik, Arjuna, Gatotkaca, Cepot). Struktur per karakter: `Dialog[karakter].gestur[...]`, `Dialog[karakter].suasana[...]`; tambah `Dialog.label`.
- [ ] **Step 4:** Buat `audio.js`: lazy `AudioContext` di `unlock()`; `play(cue)` cue sesuai tabel spec §8 (gong 70/140 Hz, saron, kendang noise lowpass 180, klik 900, drone 55, tidur 98→65); node dibuat dan diputus per cue; `ambient(true/false)` mengatur drone; `setEnabled(false)` menghentikan ambient dan membisukan play; baca/tulis `localStorage["wayang-suara"]` bila ada.
- [ ] **Step 5:** Jalankan tes hijau; `node --check` kedua berkas.
- [ ] **Step 6:** Uji manual di browser: klik tombol suara → gong pendek saat buka panggung; tidak ada error `AudioContext`.

---

### Task 4: Rig hidup + event `app.js`

**Files:**
- Modify: `frontend/js/animation.js`
- Modify: `frontend/js/app.js`
- Modify: `frontend/index.html` (hapus binding fullscreen lama bila ada)

**Interfaces:**
- `animation.js` produces: `#grup-hidup` antara `#grup-arah` dan `#grup-wayang`, origin `(width*0.63, height*0.88)`, `transformBox=view-box`; `#bayangan-wayang` ellipse di dalam `#grup-posisi` (cx 63%, cy 88%, rx 66, ry 11).
- `animation.js` menambah `Wayang.setAlive(on)`? Tidak perlu — teater mengelola kelas `idle` pada `#grup-hidup` lewat DOM. `Wayang.load` harus mempertahankan grup tersebut setiap ganti karakter.
- `app.js` produces events: `wayang:gesture` `{gesture, source, confidence}` setelah pose diterapkan (termasuk netral, termasuk dummy); `wayang:nohand`/`wayang:hand` hanya pada transisi; `wayang:wrist` `{x}` di setiap `setWrist` valid (debounce ±80 ms); `wayang:connection` `{state}`.
- `app.js` memakai `#pita-terputus` (bukan `#panggung-overlay`).
- `app.js` memanggil `Teater.init`, `Teater.exitCharacter`, `Teater.setCharacter`, `Teater.fail` bila tersedia (guard `typeof Teater !== "undefined"`).
- `app.js` menambah `app.handPresent`; reset netral tetap 1000 ms; dispatch `wayang:nohand` sekali saat transisi ke no_hand, `wayang:hand` sekali saat tangan kembali.

- [ ] **Step 1:** Ubah `animation.js`: hitung viewBox sebelum membungkus; sisipkan `#grup-hidup`; set origin; sisipkan ellipse `#bayangan-wayang` ke `#grup-posisi` sebelum `#grup-arah`. Jangan ubah `POSES` atau logika pose.
- [ ] **Step 2:** Ubah `app.js` sesuai interface di atas; pertahankan semua perilaku lama (debounce gestur sama, jempol auto-reset, dummy).
- [ ] **Step 3:** Verifikasi browser mode dummy: setiap tombol 1–6 + 0 menghasilkan pose yang sama seperti sebelumnya; console menampilkan event (`document.addEventListener("wayang:gesture", e => console.log(e.detail))`); tidak ada error.
- [ ] **Step 4:** Checkpoint — `node --check frontend/js/animation.js frontend/js/app.js`.

---

### Task 5: `theater.js` penuh

**Files:**
- Modify: `frontend/js/theater.js`

**Interfaces:**
- `Teater.init({ root })` idempoten; bila elemen teater tidak ada → gagal diam-diam.
- `Teater.exitCharacter()` → `Promise` selesai setelah animasi keluar 900 ms (atau langsung bila reduced motion).
- `Teater.setCharacter(key)` → pasang warna lampu, data-karakter, masuk dari sisi berlawanan arah hadap, balon `masuk`.
- `Teater.state()`, `Teater.isBusy()`, `Teater.setSound(on)`, `Teater.fail(message)`.
- Loop `setInterval` 250 ms memanggil `core.tick(performance.now())`; saat `document.hidden` hentikan loop dan catat waktu; saat terlihat hitung delta dan `core.shift(delta)` lalu lanjut.
- Eksekutor efek: curtain (class `terbuka`/`setengah`), light (`data-level`), bubble (queue + timer), idle (`#grup-hidup` class `idle`), sound (`Suara.play`), ambient (saron/kelip/bayangan), bow (class `membungkuk` 900 ms), exit/enter character, ribbon, character (warna).
- Event listener: `wayang:gesture`, `wayang:nohand`, `wayang:hand`, `wayang:wrist`, `wayang:connection`.
- Unlock audio pada `click`/`keydown` pertama (once). Bila panggung dibuka murni oleh gestur sebelum unlock, gong ditunda sampai interaksi pertama (simpan flag `pendingGong`).
- Tombol `#tombol-buka` memanggil `core.open("button")`; tombol suara memanggil `Suara.setEnabled`; semua efek visual tetap jalan bila audio mati.
- Reduced motion: tidak menambah `idle`, durasi transisi karakter 0, balon tetap muncul.
- Sorot telunjuk: set `--sorot-x` (20–80%) pada `#lampu`, transisi 150 ms; di luar 0,5 arah sorot mengikuti arah geser.

- [ ] **Step 1:** Implementasikan `theater.js` lengkap.
- [ ] **Step 2:** Verifikasi browser dengan backend + mode dummy:
  - pembuka: tirai tertutup, lampu redup, kartu "Tunjukkan telapak tangan", balon sambutan setelah ~1 dtk;
  - tombol Buka → gong (setelah klik), tirai buka, wayang membungkuk, balon sambutan 2;
  - gestur 1–6 → balon + lampu + suara; kepalan meredupkan lampu 1,5 dtk; telapak menaikkan;
  - diam 2 dtk → jeda (goyangan, lampu turun); diam 45 dtk → tirai setengah; 90 dtk → tidur;
  - gestur saat tidur → pembuka singkat lalu live otomatis;
  - ganti karakter → keluar 900 ms, masuk dari sisi berlawanan + balon masuk;
  - putus WS → pita tampil, balon diam; sambung → pita hilang + "Kita lanjut.";
  - tab disembunyikan 30 dtk → tidak ada ledakan event, timer bergeser;
  - suara mati → semua visual tetap, pilihan tersimpan setelah reload;
  - `prefers-reduced-motion` → tanpa goyangan.
- [ ] **Step 3:** Screenshot 1440×900 dan 1024×768; cek console bersih.

---

### Task 6: README + verifikasi akhir

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Perbarui README: struktur berkas baru, alur 4 babak, kontrol (? / suara / Info demo / tray karakter), perintah `node --test frontend/tools/test_theater.mjs`, catatan audio butuh klik pertama, catatan teater gagal → pose lama tetap jalan.
- [ ] **Step 2:** Jalankan seluruh verifikasi:
  - `node --test frontend/tools/test_theater.mjs`
  - `.venv/Scripts/python.exe backend/tools/test_logika.py`
  - `.venv/Scripts/python.exe backend/tools/test_model_service.py`
  - `.venv/Scripts/python.exe backend/tools/test_p2_model.py`
  - `.venv/Scripts/python.exe frontend/tools/check_wayang_rig.py`
  - `node --check` untuk semua JS frontend
- [ ] **Step 3:** Uji browser akhir (1440×900, 1024×768) termasuk mode dummy dan drawer; catat hasil.
