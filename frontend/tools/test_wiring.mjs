/* test_wiring.mjs — pengecekan sambungan audio ke UI.
 *
 * Dijalankan: node --test frontend/tools/test_wiring.mjs
 *
 * Kenapa berbasis sumber: theater.js butuh document + WebAudio, dan jsdom tidak
 * terpasang. Yang sering rusak bukan logikanya (udah ditutup test_audio.mjs dan
 * test_voice.mjs) tapi sambungannya: lupa <script>, lupa addEventListener, atau
 * balon dialog muncul tanpa diucapkan. Tes ini menjaga kabelnya.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const theater = readFileSync(join(root, "js", "theater.js"), "utf8");

function urutan(nama) {
  return html.indexOf('src="js/' + nama + '.js"');
}

test("voice.js dimuat, sebelum theater.js", function () {
  const vokal = urutan("voice");
  assert.ok(vokal >= 0, "js/voice.js tidak ada di index.html");
  assert.ok(vokal < urutan("theater"), "voice.js dimuat setelah theater.js");
  assert.ok(vokal > urutan("dialog"), "voice.js harus sesudah dialog.js");
});

test("slider volume dan tombol dialog ada di kartu kontrol, berlabel", function () {
  assert.match(html, /id="kontrol-volume"[^>]*type="range"/, "slider volume tidak ada");
  assert.match(html, /for="kontrol-volume"/, "slider volume tidak punya label");
  assert.match(html, /id="kontrol-volume-nilai"/, "slider volume tidak punya output angka");
  assert.match(html, /id="kontrol-dialog"[^>]*aria-pressed/, "tombol dialog tidak punya aria-pressed");
});

test("gamelan dipakai lewat Suara.musik, dengung lama sudah hilang", function () {
  assert.doesNotMatch(theater, /Suara\.ambient/, "masih memanggil API ambien lama");
  assert.match(theater, /Suara\.musik\(/, "musik tidak pernah dinyalakan");
});

test("balon dialog ikut diucapkan dan wayang memakai karakter yang benar", function () {
  assert.match(theater, /SuaraDialog\.ucap\(/, "balon tidak pernah diucapkan");
  assert.match(theater, /dataset\.karakter/, "suara tidak tahu karakter mana yang bicara");
});

test("volume dan dialog ditambatkan ke kontrolnya", function () {
  assert.match(theater, /getElementById\("kontrol-volume"\)|\$\("kontrol-volume"\)/, "slider volume tidak diambil");
  assert.match(theater, /Suara\.setVolume\(/, "slider volume tidak memanggil setVolume");
  assert.match(theater, /\$\("kontrol-dialog"\)/, "tombol dialog tidak diambil");
  assert.match(theater, /SuaraDialog\.setEnabled\(/, "tombol dialog tidak menyambung ke voice.js");
});

test("ducking musik disambungkan ke ucapan wayang", function () {
  assert.match(theater, /setPengaturDuck/, "ducking tidak pernah dipasang");
  assert.match(theater, /Suara\.ducking\(/, "ducking tidak memanggil audio.js");
});

test("preference volume dan dialog disimpan, tidak menimpa kunci suara", function () {
  assert.match(theater, /wayang-volume/, "preferensi volume tidak disimpan");
  assert.match(theater, /wayang-dialog/, "preferensi dialog tidak disimpan");
  assert.match(theater, /wayang-suara/, "kunci preferensi suara lama harus tetap dipakai");
});
