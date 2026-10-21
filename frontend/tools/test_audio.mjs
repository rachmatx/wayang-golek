/* test_audio.mjs — kontrak audio.js: berkas rekaman, bus, level, musik.
 *
 * Dijalankan: node --test frontend/tools/test_audio.mjs
 *
 * audio.js sekarang memutar berkas rekaman asli lewat WebAudio (dulu sintesis
 * osilator). Tes memakai AudioContext + fetch palsu: fetch mencatat URL yang
 * diminta dan decodeAudioData mengembalikan buffer bertanda URL asal, jadi
 * tes bisa memastikan cue yang benar memutar berkas yang benar, lewat bus
 * yang benar, dengan gain yang cukup untuk speaker laptop.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const JALUR_AUDIO = join(here, "..", "js", "audio.js");

class Param {
  constructor(nilai) {
    this._v = nilai;
    this.puncak = 0;
  }
  get value() { return this._v; }
  set value(x) { this._v = x; this.puncak = Math.max(this.puncak, x); }
  setValueAtTime(v) { this._v = v; this.puncak = Math.max(this.puncak, v); return this; }
  linearRampToValueAtTime(v) { this._v = v; this.puncak = Math.max(this.puncak, v); return this; }
  exponentialRampToValueAtTime(v) { this._v = v; this.puncak = Math.max(this.puncak, v); return this; }
  setTargetAtTime(v) { this._v = v; return this; }
  cancelScheduledValues() { return this; }
}

class Simpul {
  constructor(ctx, kelas) {
    this.ctx = ctx;
    this.kelas = kelas;
    this.outs = [];
    this.gain = new Param(1);
    this.frequency = new Param(440);
    this.type = "sine";
    this.buffer = null;
    this.loop = false;
    this.berhenti = false;
    ctx.simpul.push(this);
  }
  connect(tujuan) {
    this.outs.push(tujuan);
    this.ctx.koneksi.push([this, tujuan]);
    return tujuan;
  }
  disconnect() { this.outs.length = 0; }
  start(at) { this.mulai = at === undefined ? this.ctx.currentTime : at; this.ctx.tabuh.push(this); }
  stop() { this.berhenti = true; return this; }
}

function ctxPalsu() {
  const ctx = {
    simpul: [],
    koneksi: [],
    tabuh: [],
    currentTime: 0,
    sampleRate: 48000,
    state: "running",
    destination: null,
    resume: function () {},
  };
  ctx.destination = new Simpul(ctx, "keluar");
  ctx.createGain = function () { return new Simpul(ctx, "gain"); };
  ctx.createOscillator = function () { return new Simpul(ctx, "osc"); };
  ctx.createBufferSource = function () { return new Simpul(ctx, "src"); };
  ctx.decodeAudioData = function (data) {
    return Promise.resolve({ url: data.__url, duration: 90 });
  };
  return ctx;
}

function muat() {
  const ctx = ctxPalsu();
  const diminta = [];
  const panggung = { AudioContext: function () { return ctx; } };
  globalThis.window = panggung;
  globalThis.fetch = function (url) {
    diminta.push(url);
    return Promise.resolve({
      arrayBuffer: function () { return Promise.resolve({ __url: url }); },
    });
  };
  delete require.cache[require.resolve(JALUR_AUDIO)];
  require(JALUR_AUDIO);
  return {
    Suara: panggung.Suara,
    ctx: ctx,
    diminta: diminta,
    /** Semua sumber berkas yang benar-benar mulai diputar. */
    sumber: function () { return ctx.tabuh.filter(function (n) { return n.kelas === "src"; }); },
    /** src -> gain sendiri -> bus (sfx / musik / vokal). */
    bus: function (n) { return n.outs[0].outs[0]; },
    keLuarga: function () {
      return ctx.koneksi.filter(function (k) { return k[1] === ctx.destination; }).map(function (k) { return k[0]; });
    },
    kosong: function () { ctx.tabuh.length = 0; },
  };
}

/** Tunggu rantai fetch -> decode -> buffer siap. */
function siap() {
  return new Promise(function (r) { setImmediate(r); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

async function hidupkan(alat) {
  alat.Suara.setEnabled(true);
  alat.Suara.unlock();
  await siap();
  return alat;
}

/* Cue -> berkas yang wajib tertabuh + lantai gain sumbernya. */
const PETA_CUE = {
  buka: ["pukulan-gong-ageng.wav", 0.9],
  telapak: ["pukulan-saron.wav", 0.8],
  kepalan: ["pukulan-kendang.wav", 0.9],
  telunjuk: ["pukulan-bonang.wav", 0.75],
  dua_jari: ["pukulan-peking.wav", 0.75],
  jempol: ["kacapi-hormat.ogg", 0.85],
  ok: ["whoosh-tirai.wav", 0.65],
  saron: ["pukulan-saron.wav", 0.45],
  "ambient-nada": ["pukulan-peking.wav", 0.3],
};

function cariSumber(alat, akhiran) {
  return alat.sumber().filter(function (n) {
    return n.buffer && n.buffer.url.endsWith(akhiran);
  });
}

test("hanya satu node yang nyambung ke destination (semua lewat master)", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.play("telapak");
  alat.Suara.play("ok");
  assert.equal(alat.keLuarga().length, 1, "ada sumber audio yang menyalakan speaker langsung");
  assert.equal(alat.keLuarga()[0].kelas, "gain", "destination harus diterima master gain");
});

test("tidak ada osilator: semua bunyi dari berkas rekaman", async function () {
  const alat = await hidupkan(muat());
  Object.keys(PETA_CUE).forEach(function (cue) { alat.Suara.play(cue); });
  alat.Suara.play("tidur");
  alat.Suara.musik(true);
  const osilator = alat.ctx.simpul.filter(function (n) { return n.kelas === "osc"; });
  assert.equal(osilator.length, 0, "sintesis osilator lama masih dipakai");
  assert.ok(alat.diminta.some(function (u) { return u.endsWith("pukulan-gong-ageng.wav"); }),
    "berkas gong tidak pernah diminta");
  assert.ok(alat.sumber().length > 0, "tidak ada berkas yang diputar sama sekali");
});

test("tiap cue memutar berkas yang sesuai suasana dengan level cukup", async function () {
  const alat = await hidupkan(muat());
  for (const cue of Object.keys(PETA_CUE)) {
    const akhiran = PETA_CUE[cue][0];
    const lantai = PETA_CUE[cue][1];
    alat.kosong();
    alat.Suara.play(cue);
    const cocok = cariSumber(alat, akhiran);
    assert.ok(cocok.length > 0, cue + " tidak memutar " + akhiran);
    const puncak = Math.max.apply(null, cocok.map(function (n) { return n.outs[0].gain.puncak; }));
    assert.ok(puncak >= lantai, cue + " gain " + puncak.toFixed(2) + " < " + lantai);
  }
});

test("musik latar lewat bus musik sebagai loop, beda suasana beda berkas", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.play("telapak");
  const busSfx = alat.bus(alat.sumber()[0]);
  alat.kosong();
  alat.Suara.musik(true);
  const panggung = cariSumber(alat, "latar-panggung.ogg");
  assert.ok(panggung.length > 0, "musik live tidak memutar latar-panggung.ogg");
  assert.equal(panggung[0].loop, true, "musik latar harus loop");
  assert.notEqual(alat.bus(panggung[0]), busSfx, "musik dan SFX satu bus, ducking tidak mungkin");
  assert.equal(alat.Suara.isMusik(), true);
  alat.Suara.musik(true, "jeda");
  const jeda = cariSumber(alat, "latar-jeda.ogg");
  assert.ok(jeda.length > 0, "suasana jeda tidak memutar latar-jeda.ogg");
  assert.ok(panggung[0].berhenti, "trek panggung lama tidak dihentikan saat ganti suasana");
});

test("ducking mengecilkan musik saja dan bisa kembali", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.musik(true);
  const busMusik = alat.bus(cariSumber(alat, "latar-panggung.ogg")[0]);
  const semula = busMusik.gain.value;
  alat.Suara.play("telapak");
  const busSfx = alat.bus(alat.sumber()[alat.sumber().length - 1]);
  alat.Suara.ducking(true);
  assert.ok(busMusik.gain.value < semula, "gain musik tidak turun saat ducking");
  assert.equal(busSfx.gain.value, 0.9, "bus SFX ikut berubah saat ducking");
  alat.Suara.ducking(false);
  assert.equal(busMusik.gain.value, semula, "musik tidak kembali ke level semula");
});

test("slider volume mengubah master tanpa menggeser bus", async function () {
  const alat = await hidupkan(muat());
  const master = alat.keLuarga()[0];
  const semula = master.gain.value;
  alat.Suara.setVolume(0.2);
  assert.equal(master.gain.value, 0.2);
  assert.equal(alat.Suara.volume(), 0.2);
  assert.ok(semula > 0.2, "level master awal harus di atas 0,2 supaya slider ada gunanya");
});

test("musik berhenti total saat dimatikan", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.musik(true);
  const aktif = cariSumber(alat, "latar-panggung.ogg")[0];
  alat.Suara.musik(false);
  assert.equal(alat.Suara.isMusik(), false);
  assert.ok(aktif.berhenti, "sumber musik tidak di-stop saat musik dimatikan");
  const sebelum = alat.sumber().length;
  alat.Suara.musik(false);
  assert.equal(alat.sumber().length, sebelum, "ada sumber baru padahal musik mati");
});

test("SUARA off membungkam semua, SUARA on mengembalikan musik", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.musik(true);
  alat.Suara.setEnabled(false);
  assert.equal(alat.Suara.isMusik(), false);
  const banyak = alat.sumber().length;
  alat.Suara.play("telapak");
  assert.equal(alat.sumber().length, banyak, "SFX masih bunyi padahal SUARA dimatikan");
  alat.Suara.setEnabled(true);
  assert.ok(alat.sumber().length > banyak, "musik tidak pulih setelah SUARA dinyalakan lagi");
});

test("tidur: keprak lalu ambien jangkrik, gestur membangunkannya", async function () {
  const alat = await hidupkan(muat());
  alat.Suara.play("tidur");
  assert.ok(cariSumber(alat, "ketuk-kayu-keprak.wav").length > 0, "keprak dalang tidak tertabuh");
  const malam = cariSumber(alat, "suasana-malam.wav");
  assert.ok(malam.length > 0, "ambien jangkrik tidak mulai");
  assert.equal(malam[0].loop, true, "ambien malam harus loop");
  alat.Suara.play("telapak");
  assert.ok(malam[0].berhenti, "ambien malam tidak berhenti saat wayang bangun");
});
