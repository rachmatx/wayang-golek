/* test_prefs.mjs — pembaca preferensi volume di theater.js.
 * Diambil dari sumber theater.js supaya teruji apa adanya, tanpa ekspor khusus. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sumber = fs.readFileSync(path.join(akar, "js", "theater.js"), "utf8");

const potongan = sumber.match(/function readVolumePreference\(\)\s*\{[\s\S]*?\n  \}/);
assert.ok(potongan, "readVolumePreference() tidak ditemukan di theater.js");

function baca(nilaiTersimpan) {
  const tiruan = { localStorage: { getItem: function () { return nilaiTersimpan; } } };
  const kode = 'const VOLUME_KEY = "wayang-volume";' + potongan[0] + ";return readVolumePreference();";
  return new Function("window", kode)(tiruan);
}

test("belum pernah nyimpen volume = 0,8, bukan senyap", function () {
  assert.equal(baca(null), 0.8);
});

test("volume nol yang dipilih pengguna tetap nol", function () {
  assert.equal(baca("0"), 0);
});

test("nilai tersimpan dipakai apa adanya", function () {
  assert.equal(baca("0.35"), 0.35);
});

test("nilai rusak atau di luar rentang kembali ke 0,8", function () {
  assert.equal(baca("abc"), 0.8);
  assert.equal(baca("2"), 0.8);
  assert.equal(baca("-0.1"), 0.8);
  assert.equal(baca(""), 0.8);
});
