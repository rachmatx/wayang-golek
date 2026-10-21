/* audio.js — suara panggung dari berkas rekaman asli (assets/audio/).
 *
 * Dulu halaman ini mensintesis gamelan sendiri lewat osilator WebAudio.
 * Sekarang semua bunyi adalah rekaman gamelan sungguhan yang dimuat sebagai
 * AudioBuffer lalu diputar lewat graf yang sama: semua sumber masuk bus
 * (sfx / musik / vokal) lalu satu master, jadi volume seragam dan musik
 * bisa dikecilkan (ducking) saat wayang bicara.
 *
 * Pemetaan bunyi mengikuti suasana cerita:
 *   buka     -> gong ageng + bonang: sambutan pembuka panggung
 *   telapak  -> saron + peking: wayang terangkat, nada cerah naik
 *   kepalan  -> kendang + gong lirih: hentakan turun, wayang diam
 *   telunjuk -> bonang: ketukan tegas penunjuk arah
 *   dua_jari -> peking + saron: tongkat terangkat, nada tinggi ringan
 *   jempol   -> kacapi: petikan lembut untuk hormat
 *   ok       -> whoosh + saron: wayang berbalik arah
 *   tidur    -> keprak dalang, lalu ambien jangkrik malam mengisi panggung
 *   musik latar live  -> gamelan kraton (latar-panggung.ogg, loop mulus)
 *   musik latar jeda  -> gender wayang (latar-jeda.ogg, loop mulus, tenang)
 */
(function () {
  "use strict";

  const VOL_MASTER = 0.8;
  const VOL_SFX = 0.9;
  const VOL_MUSIK = 0.5;
  const VOL_VOKAL = 1.0;
  const MUSIK_DUCK = 0.18;
  const PUDAR_MUSIK = 1.5;

  /* Berkas audio relatif terhadap folder assets/. */
  const BERKAS = {
    "gong": "sfx/pukulan-gong-ageng.wav",
    "bonang": "sfx/pukulan-bonang.wav",
    "peking": "sfx/pukulan-peking.wav",
    "saron": "sfx/pukulan-saron.wav",
    "kendang": "sfx/pukulan-kendang.wav",
    "kacapi": "sfx/kacapi-hormat.ogg",
    "whoosh": "sfx/whoosh-tirai.wav",
    "keprak": "sfx/ketuk-kayu-keprak.wav",
    "malam": "ambien/suasana-malam.wav",
    "musik-panggung": "musik/latar-panggung.ogg",
    "musik-jeda": "musik/latar-jeda.ogg",
  };

  /* Cue gestur: daftar [berkas, gain, tunda detik]. */
  const CUE = {
    "buka": [["gong", 1.0, 0], ["bonang", 0.55, 0.5], ["saron", 0.4, 0.7]],
    "telapak": [["saron", 0.85, 0], ["peking", 0.4, 0.14]],
    "kepalan": [["kendang", 1.0, 0], ["gong", 0.3, 0.02]],
    "telunjuk": [["bonang", 0.8, 0]],
    "dua_jari": [["peking", 0.8, 0], ["saron", 0.45, 0.16]],
    "jempol": [["kacapi", 0.9, 0]],
    "ok": [["whoosh", 0.7, 0], ["saron", 0.5, 0.12]],
    "saron": [["saron", 0.5, 0]],
    "ambient-nada": [["peking", 0.35, 0]],
  };

  function dasarAudio() {
    try {
      const skrip = document.currentScript;
      if (skrip && skrip.src) return skrip.src.replace(/js\/audio\.js.*$/, "") + "assets/audio/";
    } catch (error) { /* bukan browser */ }
    return "assets/audio/";
  }
  const DASAR = dasarAudio();

  let ctx = null;
  let enabled = true;
  let unlocked = false;
  let musikDiminta = false;
  let musikJalan = false;
  let suasanaMusik = "panggung";
  let duck = false;
  let levelMaster = VOL_MASTER;
  let bus = null;
  const buffers = {};
  const janjiMuat = {};
  let musikAktif = null; /* { kunci, src, gain } */
  let malamAktif = null; /* { src, gain } */

  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    bus = {
      master: buatkanGain(VOL_MASTER),
      sfx: buatkanGain(VOL_SFX),
      musik: buatkanGain(VOL_MUSIK),
      vokal: buatkanGain(VOL_VOKAL),
    };
    bus.sfx.connect(bus.master);
    bus.musik.connect(bus.master);
    bus.vokal.connect(bus.master);
    bus.master.connect(ctx.destination);
    return ctx;
  }

  function buatkanGain(nilai) {
    const g = ctx.createGain();
    g.gain.value = nilai;
    return g;
  }

  function jalur(nama) {
    return (bus && bus[nama]) || (ctx && ctx.destination) || null;
  }

  /* ---------- pemuatan berkas ---------- */
  function muatBerkas(kunci) {
    if (buffers[kunci]) return Promise.resolve(buffers[kunci]);
    if (janjiMuat[kunci]) return janjiMuat[kunci];
    if (!ctx || typeof fetch !== "function") return Promise.resolve(null);
    janjiMuat[kunci] = fetch(DASAR + BERKAS[kunci])
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (data) {
        const hasil = ctx.decodeAudioData(data);
        if (hasil && typeof hasil.then === "function") return hasil;
        return null;
      })
      .then(function (buffer) {
        if (buffer) buffers[kunci] = buffer;
        return buffer || null;
      })
      .catch(function (error) {
        console.warn("[wayang] berkas audio gagal dimuat:", kunci, error);
        return null;
      });
    return janjiMuat[kunci];
  }

  function pramuat() {
    Object.keys(BERKAS).forEach(function (kunci) { muatBerkas(kunci); });
  }

  /* ---------- pemutaran ---------- */
  /* Putar satu berkas. Mengembalikan pegangan { src, gain } atau null bila
   * berkas belum siap (pemuatan dipicu; bunyi dilewatkan kali ini). */
  function putar(kunci, opsi) {
    if (!ctx) return null;
    const buffer = buffers[kunci];
    if (!buffer) { muatBerkas(kunci); return null; }
    const o = opsi || {};
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = Boolean(o.loop);
    const gain = buatkanGain(0.0001);
    src.connect(gain);
    const tujuan = jalur(o.bus || "sfx");
    if (tujuan) gain.connect(tujuan);
    const at = ctx.currentTime + (o.tunda || 0);
    const target = Math.max(o.gain || 0, 0.0002);
    try {
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(target, at + (o.pudarMasuk || 0.03));
    } catch (error) {
      gain.gain.value = target;
    }
    src.start(at);
    const pegangan = { kunci: kunci, src: src, gain: gain };
    src.onended = function () {
      try { src.disconnect(); gain.disconnect(); } catch (error) { /* sudah lepas */ }
    };
    return pegangan;
  }

  function pudarkanBerhenti(pegangan, detik) {
    if (!pegangan || !ctx) return;
    const at = ctx.currentTime;
    try {
      pegangan.gain.gain.cancelScheduledValues(at);
      pegangan.gain.gain.setValueAtTime(Math.max(pegangan.gain.gain.value, 0.0002), at);
      pegangan.gain.gain.exponentialRampToValueAtTime(0.0001, at + detik);
      pegangan.src.stop(at + detik + 0.05);
    } catch (error) {
      try { pegangan.src.stop(); } catch (lain) { /* sudah berhenti */ }
    }
  }

  /* ---------- ambien malam (babak tidur) ---------- */
  function mulaiMalam() {
    if (malamAktif) return;
    malamAktif = putar("malam", { bus: "musik", gain: 0.55, loop: true, pudarMasuk: 2.0 });
    if (!malamAktif) {
      muatBerkas("malam").then(function () {
        if (buffers["malam"] && !malamAktif && enabled && unlocked) mulaiMalam();
      });
    }
  }

  function hentikanMalam() {
    if (!malamAktif) return;
    pudarkanBerhenti(malamAktif, 0.8);
    malamAktif = null;
  }

  /* ---------- cue ---------- */
  function play(cue) {
    if (!enabled || !unlocked || !ctx) return;
    if (cue === "tidur") {
      putar("keprak", { bus: "sfx", gain: 0.7 });
      mulaiMalam();
      return;
    }
    /* Gestur apa pun berarti wayang bangun: ambien malam selesai. */
    hentikanMalam();
    const daftar = CUE[cue];
    if (!daftar) return;
    daftar.forEach(function (item) {
      putar(item[0], { bus: "sfx", gain: item[1], tunda: item[2] });
    });
  }

  /* ---------- musik latar ---------- */
  function kunciMusik() {
    return suasanaMusik === "jeda" ? "musik-jeda" : "musik-panggung";
  }

  function mulaiMusik(kunci) {
    if (!buffers[kunci]) {
      muatBerkas(kunci).then(function () {
        if (buffers[kunci] && musikJalan && kunciMusik() === kunci && !musikAktif) mulaiMusik(kunci);
      });
      return;
    }
    const lama = musikAktif;
    musikAktif = putar(kunci, { bus: "musik", gain: 0.95, loop: true, pudarMasuk: PUDAR_MUSIK });
    if (lama) pudarkanBerhenti(lama, PUDAR_MUSIK);
  }

  function hentikanMusik() {
    if (!musikAktif) return;
    pudarkanBerhenti(musikAktif, 0.6);
    musikAktif = null;
  }

  function terapMusik() {
    const jalan = musikDiminta && enabled && unlocked;
    musikJalan = jalan;
    if (!jalan) { hentikanMusik(); return; }
    if (!ensureContext()) { musikJalan = false; return; }
    const kunci = kunciMusik();
    if (musikAktif && musikAktif.kunci === kunci) return;
    mulaiMusik(kunci);
  }

  function musik(on, suasana) {
    if (suasana === "jeda" || suasana === "panggung") suasanaMusik = suasana;
    musikDiminta = Boolean(on);
    if (musikDiminta) hentikanMalam();
    terapMusik();
  }

  function ducking(on) {
    duck = Boolean(on);
    if (!bus) return;
    const target = duck ? MUSIK_DUCK : VOL_MUSIK;
    const at = ctx ? ctx.currentTime : 0;
    try {
      bus.musik.gain.cancelScheduledValues(at);
      bus.musik.gain.setValueAtTime(bus.musik.gain.value, at);
      bus.musik.gain.setTargetAtTime(target, at, 0.15);
    } catch (error) { /* param tidak didukung */ }
  }

  function setVolume(v) {
    const nilai = Math.min(1, Math.max(0, Number(v)));
    levelMaster = Number.isFinite(nilai) ? nilai : VOL_MASTER;
    if (!bus) return;
    try {
      bus.master.gain.cancelScheduledValues(ctx.currentTime);
      bus.master.gain.setValueAtTime(bus.master.gain.value, ctx.currentTime);
      bus.master.gain.setTargetAtTime(levelMaster, ctx.currentTime, 0.05);
    } catch (error) { /* param tidak didukung */ }
  }

  function unlock() {
    try {
      if (!ensureContext()) return;
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      unlocked = true;
      pramuat();
      terapMusik();
    } catch (error) {
      console.warn("[wayang] audio tidak bisa dimulai:", error);
    }
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled) hentikanMalam();
    terapMusik();
  }

  window.Suara = {
    unlock: unlock,
    setEnabled: setEnabled,
    enabled: function () { return enabled; },
    isUnlocked: function () { return unlocked; },
    play: play,
    musik: musik,
    setVolume: setVolume,
    volume: function () { return levelMaster; },
    ducking: ducking,
    ducked: function () { return duck; },
    isMusik: function () { return musikJalan; },
  };
})();
