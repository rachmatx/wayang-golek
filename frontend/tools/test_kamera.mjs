/* test_kamera.mjs — penjaga sambungan tombol kamera + pemilih sumber.
 *
 * Dijalankan: node --test frontend/tools/test_kamera.mjs
 *
 * Kenapa berbasis sumber: kamera dipegang backend, jadi tombolnya cuma
 * mengirim perintah WebSocket. Yang rusak biasanya kabelnya: id kontrol tidak
 * cocok, lupa aria-pressed, atau keyboard shortcut mencuri ketikan di input.
 * Satu tes menjaga kontrak hands[] tetap beku untuk Programmer 2.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "css", "teater.css"), "utf8");
const theater = readFileSync(join(root, "js", "theater.js"), "utf8");
const app = readFileSync(join(root, "js", "app.js"), "utf8");
const protocol = readFileSync(join(root, "..", "backend", "protocol.py"), "utf8");

test("ikon kamera ada di topbar, sejajar tombol suara", function () {
  assert.match(html, /id="tombol-kamera"[^>]*aria-pressed/, "tombol kamera tanpa aria-pressed");
  assert.match(html, /id="tombol-kamera"[^>]*aria-label="[^"]*kamera/i, "tombol kamera tanpa nama aksesibel");
  assert.match(html, /class="ikon-nyala"[\s\S]*class="ikon-mati"/, "tombol kamera tidak punya dua state ikon");
  const awal = html.indexOf('id="tombol-kamera"');
  assert.ok(awal > html.indexOf('id="tombol-suara"'), "tombol kamera harus sesudah tombol suara");
  assert.ok(awal < html.indexOf('id="tombol-fullscreen"'), "tombol kamera harus sebelum layar penuh");
});

test("ikon kamera ikut caption dan pola nyala/mati CSS", function () {
  const caption = html.slice(html.indexOf('id="tombol-kamera"'));
  assert.match(caption.slice(0, 900), /ikon-caption[^>]*>kamera</, "caption 'kamera' tidak ada");
  assert.match(css, /#tombol-kamera \.ikon-mati \{ display: none; \}/, "ikon mati tidak disembunyikan oleh default");
  assert.match(css, /#tombol-kamera\[data-on="false"\] \.ikon-nyala/, "state mati tidak mengganti ikon");
});

test("dropdown sumber kamera ada di kartu kontrol, berlabel, ada penyegaran", function () {
  assert.match(html, /<select id="kontrol-kamera"/, "select kamera tidak ada");
  assert.match(html, /for="kontrol-kamera"/, "select kamera tidak punya label");
  assert.match(html, /id="kontrol-kamera-segar"/, "tombol pindai ulang tidak ada");
  const awal = html.indexOf('id="kontrol-kamera"');
  assert.ok(awal < html.indexOf('id="kontrol-model"'), "kamera harus di atas Model (rantai sinyal)");
});

test("theater.js menyambung tombol kamera ke dunia luar", function () {
  assert.match(theater, /\$\("tombol-kamera"\)/, "tombol kamera tidak diambil");
  assert.match(theater, /tombolKamera\.addEventListener\("click"/, "klik kamera tidak dipasang");
  assert.match(theater, /onKamera/, "theater.js tidak pernah memanggil callback kamera");
  assert.match(theater, /setCamera:\s*setCamera|setCamera: setCamera/, "API setCamera tidak diekspor");
});

test("shortcut K menghormati fokus input, sama seperti V", function () {
  const blok = theater.slice(theater.indexOf('event.key === "k"'));
  assert.ok(blok.length > 0, "tombol K tidak ditangani");
  assert.match(blok.slice(0, 400), /closest\("input, textarea, select"\)/, "K mencuri ketikan di kontrol");
});

test("app.js mengirim perintah kamera dan mengisi dropdown dari /api/cameras", function () {
  assert.match(app, /command: "set_camera"/, "perintah set_camera tidak pernah dikirim");
  assert.match(app, /command: "set_camera_index"/, "perintah ganti index tidak pernah dikirim");
  assert.match(app, /\/api\/cameras/, "daftar kamera tidak pernah diambil");
  assert.match(app, /onKamera:/, "Teater.init tidak diberi callback kamera");
  assert.match(app, /ack.*set_camera|command === "set_camera/, "ack kamera tidak ditangani");
});

test("kontrak hands[] beku: status kamera tidak nyelonong ke pesan prediksi", function () {
  assert.doesNotMatch(protocol, /camera_index|camera_aktif/, "field kamera masuk ke kontrak WebSocket");
  assert.match(protocol, /"hands":/, "kontrak hands[] hilang");
});
