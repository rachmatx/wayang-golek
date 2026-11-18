/* audio.js — suara panggung dari berkas rekaman asli (assets/audio/).
 *
 * Dulu halaman ini mensintesis gamelan sendiri lewat osilator WebAudio.
 * Instrumen gamelan memakai rekaman; kayu/whoosh/ambien memakai aset
 * prosedural. Semuanya dimuat sebagai
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
 *   jempol   -> saron lirih: cue digital untuk hormat
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
    "jempol": [["saron", 0.9, 0]],
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
  const channelLevels = { sfx: VOL_SFX, musik: VOL_MUSIK };
  const channelEnabled = { sfx: true, musik: true };
  let bus = null;
  const buffers = {};
  const janjiMuat = {};
  const gagalMuat = new Set();
  let musikAktif = null; /* { kunci, src, gain } */
  const activeEffects=new Set();
  let lastMotionAt=-Infinity;
  let motionVariant=0;
  let malamDiminta = false;
  let malamAktif = null; /* { src, gain } */

  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    ctx.onstatechange = notifyStatus;
    bus = {
      master: buatkanGain(enabled ? levelMaster : 0),
      sfx: buatkanGain(channelEnabled.sfx ? channelLevels.sfx : 0),
      musik: buatkanGain(channelEnabled.musik ? channelLevels.musik * (duck ? MUSIK_DUCK / VOL_MUSIK : 1) : 0),
      vokal: buatkanGain(VOL_VOKAL),
    };
    if(typeof ctx.createDynamicsCompressor==='function') {
      const limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-12;limiter.knee.value=6;limiter.ratio.value=12;
      limiter.attack.value=.003;limiter.release.value=.18;
      bus.sfx.connect(limiter);limiter.connect(bus.master);
    } else bus.sfx.connect(bus.master);
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
      .then(function (res) { if (res.ok === false) throw new Error("HTTP " + res.status); return res.arrayBuffer(); })
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
        gagalMuat.add(kunci);
        notifyStatus();
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
    if(!o.loop&&(o.bus||'sfx')==='sfx') {
      activeEffects.add(pegangan);
      while(activeEffects.size>6)stopEffect(activeEffects.values().next().value);
    }
    src.onended = function () {
      activeEffects.delete(pegangan);
      try { src.disconnect(); gain.disconnect(); } catch (error) { /* sudah lepas */ }
    };
    return pegangan;
  }

  function stopEffect(handle) {
    activeEffects.delete(handle);
    try {
      const at=ctx.currentTime;
      handle.gain.gain.cancelScheduledValues(at);
      handle.gain.gain.setValueAtTime(Math.max(.0001,handle.gain.gain.value),at);
      handle.gain.gain.linearRampToValueAtTime(.0001,at+.012);
      handle.src.stop(at+.015); // Short release avoids clicks; onended releases graph nodes.
    }catch(error){
      try{handle.src.stop();handle.src.disconnect();handle.gain.disconnect();}catch(ended){/* already ended */}
    }
  }
  function stopEffects() {
    Array.from(activeEffects).forEach(stopEffect);
    lastMotionAt=-Infinity;
  }
  function playMotion(cue) {
    if(!cue||!enabled||!unlocked||!ctx||ctx.state!=='running'||!channelEnabled.sfx||channelLevels.sfx===0||levelMaster===0)return false;
    if(!['saron','peking','bonang','kendang','keprak','whoosh'].includes(cue.sound)||!Number.isFinite(cue.gain)||cue.gain<=0)return false;
    // A shared onset budget keeps simultaneous P1/P2 accents from piling up.
    if(ctx.currentTime-lastMotionAt<.12)return false;
    const gain=Math.min(.65,cue.gain)*(motionVariant%2?.94:1);
    const handle=putar(cue.sound,{bus:'sfx',gain});
    if(!handle)return false; // Never queue late hits while a recording loads.
    lastMotionAt=ctx.currentTime;motionVariant+=1;
    return true;
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
    malamDiminta = true;
    if (malamAktif || !channelEnabled.musik) return;
    malamAktif = putar("malam", { bus: "musik", gain: 0.55, loop: true, pudarMasuk: 2.0 });
    if (!malamAktif) {
      muatBerkas("malam").then(function () {
        if (buffers["malam"] && malamDiminta && !malamAktif && enabled && unlocked && channelEnabled.musik) mulaiMalam();
      });
    }
  }

  function hentikanMalam() {
    malamDiminta = false;
    if (!malamAktif) return;
    pudarkanBerhenti(malamAktif, 0.8);
    malamAktif = null;
  }

  /* ---------- cue ---------- */
  function play(cue) {
    if (!enabled || !unlocked || !ctx) return;
    if (!channelEnabled.sfx && cue !== "tidur") return;
    if (cue === "tidur") {
      if (channelEnabled.sfx) putar("keprak", { bus: "sfx", gain: 0.7 });
      mulaiMalam();
      return;
    }
    /* Gestur apa pun berarti wayang bangun: ambien malam selesai. */
    hentikanMalam();
    const daftar = CUE[cue === "telapak_terbuka" ? "telapak" : cue];
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
    notifyStatus();
  }

  function hentikanMusik() {
    if (!musikAktif) return;
    pudarkanBerhenti(musikAktif, 0.6);
    musikAktif = null;
    notifyStatus();
  }

  function terapMusik() {
    const jalan = musikDiminta && channelEnabled.musik && enabled && unlocked;
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
    const target = channelEnabled.musik ? channelLevels.musik * (duck ? MUSIK_DUCK / VOL_MUSIK : 1) : 0;
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
    if(levelMaster===0)stopEffects();
    if (!bus) return;
    try {
      bus.master.gain.cancelScheduledValues(ctx.currentTime);
      bus.master.gain.setValueAtTime(bus.master.gain.value, ctx.currentTime);
      bus.master.gain.setTargetAtTime(enabled ? levelMaster : 0, ctx.currentTime, 0.05);
    } catch (error) { /* param tidak didukung */ }
  }

  function unlock() {
    try {
      if (!ensureContext()) return;
      if (ctx.state === "suspended" && ctx.resume) {
        const resuming = ctx.resume();
        if (resuming && resuming.then) resuming.then(notifyStatus).catch(function () { unlocked = false; notifyStatus(); });
      }
      unlocked = true;
      pramuat();
      terapMusik();
      notifyStatus();
    } catch (error) {
      console.warn("[wayang] audio tidak bisa dimulai:", error);
    }
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    setVolume(levelMaster);
    if (!enabled) {hentikanMalam();stopEffects();}
    terapMusik();
  }

  function status() {
    return {
      context: ctx ? ctx.state : "locked",
      available: Boolean(window.AudioContext || window.webkitAudioContext),
      musicPlaying: Boolean(musikAktif && musikJalan && ctx && ctx.state === "running"),
      musicFailed: gagalMuat.has(kunciMusik()),
      activeEffects: activeEffects.size,
    };
  }
  function notifyStatus() {
    if (typeof document !== "undefined" && typeof CustomEvent === "function") {
      document.dispatchEvent(new CustomEvent("wayang:audio-status", { detail: status() }));
    }
  }

  function setChannelVolume(channel, value) {
    if (!(channel in channelLevels)) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    channelLevels[channel] = Math.max(0, Math.min(1, numeric));
    if(channel==='sfx'&&channelLevels.sfx===0)stopEffects();
    if (channel === "musik") { ducking(duck); return; }
    if (bus) bus.sfx.gain.setTargetAtTime(channelEnabled.sfx ? channelLevels.sfx : 0, ctx.currentTime, 0.03);
  }

  function setChannelEnabled(channel, on) {
    if (!(channel in channelEnabled)) return;
    channelEnabled[channel] = Boolean(on);
    if(channel==='sfx'&&!on)stopEffects();
    setChannelVolume(channel, channelLevels[channel]);
    if (channel === "musik") {
      if (!on) hentikanMalam();
      terapMusik();
    }
  }

  window.Suara = {
    unlock: unlock,
    status: status,
    setEnabled: setEnabled,
    enabled: function () { return enabled; },
    isUnlocked: function () { return unlocked; },
    play: play,
    playMotion: playMotion,
    stopEffects: stopEffects,
    musik: musik,
    setVolume: setVolume,
    setChannelVolume: setChannelVolume,
    setChannelEnabled: setChannelEnabled,
    volume: function () { return levelMaster; },
    ducking: ducking,
    ducked: function () { return duck; },
    isMusik: function () { return musikJalan; },
  };
})();
