/* test_voice.mjs — kontrak js/voice.js: satu wayang ngomong sekali waktu.
 *
 * Dijalankan: node --test frontend/tools/test_voice.mjs
 *
 * speechSynthesis dipalsukan: yang mau dibuktikan adalah pilihan profil suara,
 * penolakan tumpukan ucapan, dan ducking musik — bukan kualitas suara browser.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const JALUR = join(here, "..", "js", "voice.js");

function panggungPalsu(daftarVoz) {
  const ucap = [];
  const sintesis = {
    speak: function (u) {
      ucap.push(u);
      if (u.onstart) u.onstart();
    },
    cancel: function () {},
    getVoices: function () { return daftarVoz || []; },
  };
  const pangggung = {
    speechSynthesis: sintesis,
    SpeechSynthesisUtterance: function (text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
    },
  };
  return {
    window: pangggung,
    ucap: ucap,
    terakhir: function () { return ucap[ucap.length - 1]; },
    selesai: function () {
      const u = ucap[ucap.length - 1];
      if (u && u.onend) u.onend();
    },
  };
}

function muat(daftarVoz) {
  const panggung = panggungPalsu(daftarVoz);
  globalThis.window = panggung.window;
  delete require.cache[require.resolve(JALUR)];
  require(JALUR);
  panggung.SuaraDialog = panggung.window.SuaraDialog;
  panggung.kunci = function (nama) {
    const log = [];
    panggung.SuaraDialog.setPengaturDuck(function (aktif) { log.push(aktif); });
    return log;
  };
  return panggung;
}

test("empat karakter punya karakter suara yang beda", function () {
  const alat = muat();
  const ambil = function (kunci) {
    alat.ucap.length = 0;
    alat.SuaraDialog.ucap(kunci, "Halo dalang.");
    alat.selesai();
    return alat.terakhir();
  };
  const klasik = ambil("klasik");
  const arjuna = ambil("arjuna");
  const gatotkaca = ambil("gatotkaca");
  const cepot = ambil("cepot");
  [klasik, arjuna, gatotkaca, cepot].forEach(function (u) { assert.ok(u, "tidak ada ucapan"); });
  assert.equal(klasik.lang, "id-ID");
  assert.ok(arjuna.rate < 1 && arjuna.pitch <= 1, "Arjuna harus tenang dan rendah");
  assert.ok(gatotkaca.pitch < arjuna.pitch, "Gatotkaca harus lebih berat dari Arjuna");
  assert.ok(cepot.rate > 1 && cepot.pitch > 1, "Cepot harus ngebacot dan tinggi");
  const nilai = new Set([arjuna.pitch, gatotkaca.pitch, cepot.pitch].map(function (x) { return x.toFixed(2); }));
  assert.equal(nilai.size, 3, "ada dua karakter dengan pitch sama");
});

test("karakter tidak dikenal pakai suara klasik, tidak crash", function () {
  const alat = muat();
  const hasil = alat.SuaraDialog.ucap("buto-ijo", "Aku bukan siapa-siapa.");
  assert.equal(hasil, true);
  assert.equal(alat.terakhir().text, "Aku bukan siapa-siapa.");
});

test("wayang tidak memotong bicaranya sendiri", function () {
  const alat = muat();
  assert.equal(alat.SuaraDialog.ucap("cepot", "Baris pertama."), true);
  assert.equal(alat.SuaraDialog.isBicara(), true);
  assert.equal(alat.SuaraDialog.ucap("cepot", "Baris kedua."), false, "ucapan kedua ikut numpuk");
  assert.equal(alat.ucap.length, 1);
  alat.selesai();
  assert.equal(alat.SuaraDialog.isBicara(), false);
  assert.equal(alat.SuaraDialog.ucap("cepot", "Baris ketiga."), true);
});

test("musik dikecilkan hanya selama wayang bicara", function () {
  const alat = muat();
  const log = alat.kunci();
  alat.SuaraDialog.ucap("arjuna", "Selamat malam, dalang.");
  assert.deepEqual(log, [true], "ducking tidak aktif saat ucapan mulai");
  alat.selesai();
  assert.deepEqual(log, [true, false], "musik tidak kembali normal setelah selesai");
});

test("VOICE mati = tidak ada ucapan", function () {
  const alat = muat();
  alat.SuaraDialog.setEnabled(false);
  assert.equal(alat.SuaraDialog.ucap("cepot", "Halo?"), false);
  assert.equal(alat.ucap.length, 0);
  alat.SuaraDialog.setEnabled(true);
  assert.equal(alat.SuaraDialog.ucap("cepot", "Halo?"), true);
});

test("browser tanpa speechSynthesis tidak bikin panggung error", function () {
  const alat = muat();
  alat.window.speechSynthesis = undefined;
  alat.SuaraDialog.setEnabled(true);
  assert.equal(alat.SuaraDialog.ucap("klasik", "Coba bicara."), false);
  assert.equal(alat.ucap.length, 0);
});

test("kalimat kosong tidak diucapkan", function () {
  const alat = muat();
  assert.equal(alat.SuaraDialog.ucap("klasik", ""), false);
  assert.equal(alat.SuaraDialog.ucap("klasik", "   "), false);
  assert.equal(alat.SuaraDialog.ucap("klasik", null), false);
  assert.equal(alat.ucap.length, 0);
});

test("suara id-ID dipilih kalau browser punya", function () {
  const jawa = { lang: "jv", name: "Jawa" };
  const indo = { lang: "id-ID", name: "Bahasa Indonesia" };
  const alat = muat([jawa, indo]);
  alat.SuaraDialog.ucap("cepot", "Halo.");
  assert.equal(alat.terakhir().voice, indo, "voice Indonesia tidak dipilih");
});
