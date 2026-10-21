/* audio.js — gamelan sintetis lewat WebAudio. Tidak ada berkas audio.
 *
 * Semua sumber masuk lewat bus (sfx / musik / vokal) lalu satu master, jadi
 * volume bisa diatur seragam dan musik bisa dikecilkan saat wayang bicara.
 * AudioContext baru dibuat setelah interaksi pengguna nyata (klik/tombol).
 */
(function () {
  "use strict";

  const VOL_MASTER = 0.8;
  const VOL_SFX = 0.9;
  const VOL_MUSIK = 0.5;
  const VOL_VOKAL = 1.0;
  const MUSIK_DUCK = 0.18;

  const TEMPOT = 60;
  const KETUK = 60 / TEMPOT;
  const BAR_PANJANG = KETUK * 4;
  const LIHAT = 1.5;
  const JEDA_TIC = 200;
  const SLENDRO = [280, 325, 370, 440, 500];
  const MOTIF = [
    [0, 2, 1, 3], [2, 1, 0, 1], [1, 3, 2, 0], [3, 2, 1, 2],
    [0, 1, 2, 3], [2, 3, 2, 1], [1, 0, 2, 1], [3, 2, 1, 0],
  ];

  let ctx = null;
  let enabled = true;
  let unlocked = false;
  let musikDiminta = false;
  let musikJalan = false;
  let duck = false;
  let levelMaster = VOL_MASTER;
  let bus = null;
  let tic = null;
  let bar = 0;
  let waktuBar = null;

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

  function pasang(node, nama) {
    const tujuan = jalur(nama);
    if (tujuan) node.connect(tujuan);
  }

  function note(freq, at, duration, volume, type, nama) {
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    pasang(gain, nama || "sfx");
    osc.start(at);
    osc.stop(at + duration + 0.05);
    osc.onended = function () {
      try { osc.disconnect(); gain.disconnect(); } catch (error) { /* sudah lepas */ }
    };
    return osc;
  }

  function glide(from, to, at, duration, volume) {
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    pasang(gain, "sfx");
    osc.start(at);
    osc.stop(at + duration + 0.05);
    osc.onended = function () {
      try { osc.disconnect(); gain.disconnect(); } catch (error) { /* sudah lepas */ }
    };
    return osc;
  }

  function noise(at, duration, volume, cutoff, nama) {
    if (!ctx) return null;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    pasang(gain, nama || "sfx");
    source.start(at);
    source.stop(at + duration);
    source.onended = function () {
      try { source.disconnect(); filter.disconnect(); gain.disconnect(); } catch (error) { /* sudah lepas */ }
    };
    return { source: source, filter: filter, gain: gain };
  }

  function gong(at, duration, volume, nama) {
    note(70, at, duration, volume, "sine", nama);
    note(70.4, at, duration * 0.9, volume * 0.45, "sine", nama);
    note(140, at, duration * 0.55, volume * 0.18, "sine", nama);
  }

  function kenong(at, volume) {
    note(124, at, 0.5, volume, "sine");
    note(248, at, 0.3, volume * 0.22, "triangle");
  }

  function saron(at, indices, step, volume) {
    indices.forEach(function (index, hit) {
      const freq = SLENDRO[index % SLENDRO.length];
      note(freq, at + hit * step, step + 0.35, volume, "triangle");
      note(freq * 2, at + hit * step, step + 0.18, volume * 0.22, "sine");
    });
  }

  function saronNote(at, volume) {
    const freq = SLENDRO[Math.floor(Math.random() * SLENDRO.length)];
    note(freq, at, 0.7, volume, "triangle");
    note(freq * 2, at, 0.4, volume * 0.2, "sine");
  }

  function play(cue) {
    if (!enabled || !unlocked || !ctx) return;
    const at = ctx.currentTime + 0.01;
    switch (cue) {
      case "buka":
        gong(at, 2.6, 0.55);
        saron(at + 0.5, [0, 2, 4], 0.2, 0.2);
        break;
      case "telapak":
        saron(at, [0, 2, 4], 0.18, 0.3);
        break;
      case "kepalan":
        noise(at, 0.3, 0.34, 450);
        gong(at, 0.9, 0.14);
        break;
      case "telunjuk":
        kenong(at, 0.26);
        break;
      case "dua_jari":
        saron(at, [1, 4], 0.2, 0.3);
        break;
      case "jempol":
        gong(at, 1.2, 0.28);
        noise(at, 0.18, 0.12, 1400);
        break;
      case "ok":
        saron(at, [4, 2, 0], 0.16, 0.3);
        noise(at, 0.5, 0.1, 2200);
        break;
      case "tidur":
        glide(98, 65, at, 2, 0.34);
        break;
      case "saron":
        saronNote(at, 0.16);
        break;
      case "ambient-nada":
        saronNote(at, 0.1);
        break;
      default:
        break;
    }
  }

  /* ---------- gamelan ---------- */
  function tabuhBar(mulai) {
    const pola = MOTIF[bar % MOTIF.length];
    for (let hit = 0; hit < pola.length; hit += 1) {
      const at = mulai + hit * KETUK;
      const freq = SLENDRO[pola[hit] % SLENDRO.length];
      note(freq, at, 0.55, 0.16, "triangle", "musik");
      note(freq * 2, at, 0.3, 0.04, "sine", "musik");
      if (bar % 2 === 0 && hit === 2) note(124, at, 1.1, 0.12, "sine", "musik");
    }
    if (bar % 4 === 3) note(90, mulai, 2.2, 0.2, "sine", "musik");
    if (bar % 8 === 7) gong(mulai, 3.4, 0.3, "musik");
    bar += 1;
  }

  function jalanTic() {
    if (!ctx || !musikJalan) return;
    if (waktuBar === null) waktuBar = ctx.currentTime + 0.05;
    while (waktuBar < ctx.currentTime + LIHAT) {
      tabuhBar(waktuBar);
      waktuBar += BAR_PANJANG;
    }
    tic = setTimeout(jalanTic, JEDA_TIC);
  }

  function terapMusik() {
    const jalan = musikDiminta && enabled && unlocked;
    clearTimeout(tic);
    tic = null;
    waktuBar = null;
    musikJalan = jalan;
    if (!jalan) return;
    if (!ensureContext()) { musikJalan = false; return; }
    bar = 0;
    jalanTic();
  }

  function musik(on) {
    musikDiminta = Boolean(on);
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
    } catch (error) {
      console.warn("[wayang] audio tidak bisa dimulai:", error);
    }
  }

  function setEnabled(on) {
    enabled = Boolean(on);
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
