/* test_audio.mjs — kontrak audio.js: bus, level, gamelan.
 *
 * Dijalankan: node --test frontend/tools/test_audio.mjs
 *
 * Kenapa pakai AudioContext + jam palsu: audio.js 100% WebAudio. Satu-satunya
 * cara memastikan "tidak ada sumber yang menyalakan speaker langsung" dan
 * "gong ditabuh tiap 8 birama" adalah mengamati graf node dan waktu schedulenya.
 * Timer dipalsukan seumur proses supaya scheduler bisa diputar maju per birama.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const JALUR_AUDIO = join(here, "..", "js", "audio.js");

const antrianTic = new Map();
let idTic = 0;
globalThis.setTimeout = function (fn) {
  idTic += 1;
  antrianTic.set(idTic, fn);
  return idTic;
};
globalThis.clearTimeout = function (kunci) { antrianTic.delete(kunci); };

class Param {
  constructor(nilai) {
    this._v = nilai;
    /* puncak 0, bukan nilai awal: gain default WebAudio memang 1.0 tapi tidak
     * pernah dialiri kalau kodenya membuat envelope sendiri. */
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
    this.detune = new Param(0);
    this.Q = new Param(1);
    this.type = "sine";
    ctx.simpul.push(this);
  }
  connect(tujuan) {
    this.outs.push(tujuan);
    this.ctx.koneksi.push([this, tujuan]);
    return tujuan;
  }
  disconnect() { this.outs.length = 0; }
  start(at) { this.mulai = at === undefined ? this.ctx.currentTime : at; this.ctx.tabuh.push(this); }
  stop() { return this; }
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
  ctx.createBiquadFilter = function () { return new Simpul(ctx, "filter"); };
  ctx.createBufferSource = function () { return new Simpul(ctx, "src"); };
  ctx.createBuffer = function (kanal, panjang) {
    return { length: panjang, getChannelData: function () { return new Float32Array(panjang); } };
  };
  return ctx;
}

function muat() {
  const ctx = ctxPalsu();
  const pangggung = { AudioContext: function () { return ctx; } };
  globalThis.window = pangggung;
  delete require.cache[require.resolve(JALUR_AUDIO)];
  require(JALUR_AUDIO);
  return {
    Suara: pangggung.Suara,
    ctx: ctx,
    /** Semua osilator yang benar-benar mulai ditabuh. */
    nada: function () { return ctx.tabuh.filter(function (n) { return n.kelas === "osc"; }); },
    /** osc -> gain sendiri -> bus (sfx / musik / vokal). */
    bus: function (n) { return n.outs[0].outs[0]; },
    keLuarga: function () {
      return ctx.koneksi.filter(function (k) { return k[1] === ctx.destination; }).map(function (k) { return k[0]; });
    },
    /** Putar jam `detik` ke depan lalu jalankan scheduler yang tertunda. */
    maju: function (detik) {
      const menunggu = Array.from(antrianTic.values());
      antrianTic.clear();
      ctx.currentTime = detik;
      menunggu.forEach(function (fn) { fn(); });
      return menunggu.length;
    },
    kosong: function () { ctx.simpul.length = 0; ctx.tabuh.length = 0; },
  };
}

function hidupkan(alat) {
  alat.Suara.setEnabled(true);
  alat.Suara.unlock();
  return alat;
}

const BIRAMA = 4;

const LANTAI = {
  buka: 0.5, telapak: 0.28, kepalan: 0.3, telunjuk: 0.24,
  dua_jari: 0.28, jempol: 0.26, ok: 0.28, tidur: 0.32, saron: 0.15,
};

/** Puncuk envelope yang benar-benar dialiri: osc->gain atau src->filter->gain. */
function amplop(alat) {
  const hasil = [];
  alat.ctx.tabuh.forEach(function (n) {
    if (n.kelas === "osc" && n.outs[0]) hasil.push(n.outs[0]);
    if (n.kelas === "src" && n.outs[0] && n.outs[0].outs[0]) hasil.push(n.outs[0].outs[0]);
  });
  return hasil.filter(function (g) { return g.kelas === "gain"; });
}

function puncakSFX(alat) {
  const nilai = amplop(alat).map(function (g) { return g.gain.puncak; });
  return nilai.length ? Math.max.apply(null, nilai) : 0;
}

test("hanya satu node yang nyambung ke destination (semua lewat master)", function () {
  const alat = hidupkan(muat());
  alat.Suara.play("telapak");
  alat.Suara.play("ok");
  assert.equal(alat.keLuarga().length, 1, "ada sumber audio yang menyalakan speaker langsung");
  assert.equal(alat.keLuarga()[0].kelas, "gain", "destination harus diterima master gain");
});

test("level SFX cukup keras buat speaker laptop", function () {
  const alat = hidupkan(muat());
  Object.keys(LANTAI).forEach(function (cue) {
    alat.kosong();
    alat.Suara.play(cue);
    const puncak = puncakSFX(alat);
    assert.ok(puncak > 0, cue + " tidak menabuh apa pun");
    assert.ok(puncak >= LANTAI[cue], cue + " puncak " + puncak.toFixed(3) + " < " + LANTAI[cue]);
  });
});

test("kepalan tidak lagi dikubur di bawah 400 Hz", function () {
  const alat = hidupkan(muat());
  alat.Suara.play("kepalan");
  const saring = alat.ctx.simpul.filter(function (n) { return n.kelas === "filter"; });
  assert.ok(saring.length > 0, "kepalan tidak memakai filter sama sekali");
  const cutoff = Math.max.apply(null, saring.map(function (n) { return n.frequency.value; }));
  assert.ok(cutoff >= 400, "cutoff " + cutoff + " Hz masih di luar rentang speaker laptop");
});

test("musik gamelan lewat bus sendiri, bukan bus SFX", function () {
  const alat = hidupkan(muat());
  alat.Suara.play("telapak");
  const busSfx = alat.bus(alat.nada()[0]);
  assert.equal(alat.bus(alat.nada()[0]).outs[0], alat.keLuarga()[0], "bus SFX tidak mengalir ke master");
  alat.kosong();
  alat.Suara.musik(true);
  assert.ok(alat.nada().length > 0, "musik aktif tapi tidak ada nada dijadwalkan");
  assert.notEqual(alat.bus(alat.nada()[0]), busSfx, "gamelan dan SFX satu bus, ducking tidak mungkin");
  assert.equal(alat.Suara.isMusik(), true);
});

test("gong ageng ditabuh satu kali tiap delapan birama", function () {
  const alat = hidupkan(muat());
  alat.Suara.musik(true);
  for (let indeks = 1; indeks <= 9; indeks += 1) alat.maju(indeks * BIRAMA);
  const gong = alat.nada().filter(function (n) { return n.frequency.value === 70; });
  assert.equal(gong.length, 1, "ditemukan " + gong.length + " gong untuk 9 birama");
  assert.ok(alat.nada().length >= 30, "pattern terlalu jarang: " + alat.nada().length + " nada untuk 9 birama");
});

test("ducking mengecilkan musik saja dan bisa kembali", function () {
  const alat = hidupkan(muat());
  alat.Suara.musik(true);
  const busMusik = alat.bus(alat.nada()[0]);
  const semula = busMusik.gain.value;
  alat.Suara.play("telapak");
  const busSfx = alat.bus(alat.nada()[alat.nada().length - 1]);
  alat.Suara.ducking(true);
  assert.ok(busMusik.gain.value < semula, "gain musik tidak turun saat ducking");
  assert.equal(busSfx.gain.value, 0.9, "bus SFX ikut berubah saat ducking");
  alat.Suara.ducking(false);
  assert.equal(busMusik.gain.value, semula, "musik tidak kembali ke level semula");
});

test("slider volume mengubah master tanpa menggeser bus", function () {
  const alat = hidupkan(muat());
  const master = alat.keLuarga()[0];
  const semula = master.gain.value;
  alat.Suara.setVolume(0.2);
  assert.equal(master.gain.value, 0.2);
  assert.equal(alat.Suara.volume(), 0.2);
  assert.ok(semula > 0.2, "level master awal harus di atas 0,2 supaya slider ada gunanya");
});

test("musik berhenti total saat dimatikan", function () {
  const alat = hidupkan(muat());
  alat.Suara.musik(true);
  alat.maju(BIRAMA);
  const sebelum = alat.nada().length;
  alat.Suara.musik(false);
  assert.equal(alat.Suara.isMusik(), false);
  alat.maju(BIRAMA * 2);
  assert.equal(alat.nada().length, sebelum, "masih ada nada dijadwalkan setelah musik mati");
});

test("SUARA off membungkam gamelan, SUARA on mengembalikannya", function () {
  const alat = hidupkan(muat());
  alat.Suara.musik(true);
  alat.Suara.setEnabled(false);
  assert.equal(alat.Suara.isMusik(), false);
  const banyak = alat.nada().length;
  alat.maju(BIRAMA);
  assert.equal(alat.nada().length, banyak, "masih menabuh padahal SUARA dimatikan");
  alat.Suara.play("telapak");
  assert.equal(alat.nada().length, banyak, "SFX masih bunyi padahal SUARA dimatikan");
  alat.Suara.setEnabled(true);
  alat.maju(BIRAMA * 2);
  assert.ok(alat.nada().length > banyak, "gamelan tidak pulih setelah SUARA dinyalakan lagi");
});

test("dengung ambien 55 Hz sudah diganti gamelan", function () {
  const alat = hidupkan(muat());
  alat.Suara.musik(true);
  for (let indeks = 1; indeks <= 4; indeks += 1) alat.maju(indeks * BIRAMA);
  const dengung = alat.nada().filter(function (n) { return n.frequency.value <= 60; });
  assert.equal(dengung.length, 0, "dengung ambien lama masih ada");
});
