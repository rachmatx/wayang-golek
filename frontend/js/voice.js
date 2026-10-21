/* voice.js — wayang "ngomong": berkas audio dialog per karakter bila ada,
 * kalau tidak ada jatuh ke suara bawaan browser (speechSynthesis).
 *
 * Peta berkas ada di js/dialog_audio.js (window.DialogAudio): kunci karakter
 * + teks persis -> jalur relatif dari assets/audio/. Sekali jalan satu
 * ucapan — wayang tidak memotong bicaranya sendiri, dan gamelan dikecilkan
 * selama ia bicara (lewat pengaturDuck, dari berkas maupun TTS).
 */
(function () {
  "use strict";

  const PROFIL = {
    klasik: { rate: 0.95, pitch: 1.0 },
    arjuna: { rate: 0.82, pitch: 0.82 },
    gatotkaca: { rate: 1.0, pitch: 0.62 },
    cepot: { rate: 1.22, pitch: 1.3 },
  };

  let enabled = true;
  let bicara = false;
  let pengaturDuck = null;
  let pemain = null;
  const berkasBusuk = {};
  const sudahPreload = {};

  function dasarAudio() {
    try {
      const skrip = document.currentScript;
      if (skrip && skrip.src) return skrip.src.replace(/js\/voice\.js.*$/, "") + "assets/audio/";
    } catch (error) { /* bukan browser */ }
    return "assets/audio/";
  }
  const DASAR = dasarAudio();

  function cariVoz() {
    const sintesis = window.speechSynthesis;
    if (!sintesis || typeof sintesis.getVoices !== "function") return null;
    const daftar = sintesis.getVoices() || [];
    for (let index = 0; index < daftar.length; index += 1) {
      const bahasa = String(daftar[index].lang || "").toLowerCase();
      if (bahasa.indexOf("id") === 0) return daftar[index];
    }
    return null;
  }

  function selesai() {
    bicara = false;
    if (pengaturDuck) pengaturDuck(false);
  }

  function petaBerkas() {
    if (typeof window === "undefined") return null;
    return window.DialogAudio || null;
  }

  function cariBerkas(kunci, kalimat) {
    const peta = petaBerkas();
    if (!peta || !peta[kunci]) return null;
    if (typeof window.Audio !== "function") return null;
    const rel = peta[kunci][kalimat];
    if (!rel || berkasBusuk[rel]) return null;
    return rel;
  }

  function preloadKarakter(kunci) {
    if (sudahPreload[kunci]) return;
    sudahPreload[kunci] = true;
    const peta = petaBerkas();
    if (!peta || !peta[kunci] || typeof window.Audio !== "function") return;
    try {
      Object.keys(peta[kunci]).forEach(function (teks) {
        const el = new window.Audio();
        el.preload = "auto";
        el.src = DASAR + peta[kunci][teks];
      });
    } catch (error) { /* preload cuma pemanasan, boleh gagal diam-diam */ }
  }

  function ucapBerkas(kunci, kalimat, rel) {
    let el;
    try {
      el = new window.Audio();
    } catch (error) {
      return false;
    }
    pemain = el;
    bicara = true;
    let jatuh = false;
    function gagal() {
      berkasBusuk[rel] = true;
      if (pemain === el) pemain = null;
      if (jatuh) return;
      jatuh = true;
      bicara = false;
      if (!ucapTTS(kunci, kalimat)) selesai();
    }
    el.preload = "auto";
    el.src = DASAR + rel;
    el.addEventListener("playing", function () {
      if (pengaturDuck) pengaturDuck(true);
    });
    el.addEventListener("ended", function () {
      if (pemain === el) pemain = null;
      selesai();
    });
    el.addEventListener("error", gagal);
    try {
      const janji = el.play();
      if (janji && typeof janji.catch === "function") janji.catch(gagal);
    } catch (error) {
      gagal();
      return true; /* sudah ditangani lewat jalur cadangan */
    }
    preloadKarakter(kunci);
    return true;
  }

  function ucapTTS(kunci, kalimat) {
    const sintesis = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!sintesis || typeof sintesis.speak !== "function" || !Utterance) return false;

    const profil = PROFIL[kunci] || PROFIL.klasik;
    const bunyi = new Utterance(kalimat);
    bunyi.lang = "id-ID";
    bunyi.rate = profil.rate;
    bunyi.pitch = profil.pitch;
    const voz = cariVoz();
    if (voz) bunyi.voice = voz;
    bunyi.onstart = function () {
      bicara = true;
      if (pengaturDuck) pengaturDuck(true);
    };
    bunyi.onend = selesai;
    bunyi.onerror = selesai;

    bicara = true;
    sintesis.speak(bunyi);
    return true;
  }

  function ucap(kunci, teks) {
    const kalimat = typeof teks === "string" ? teks.trim() : "";
    if (!enabled || !kalimat || bicara) return false;
    const rel = cariBerkas(kunci, kalimat);
    if (rel) return ucapBerkas(kunci, kalimat, rel);
    return ucapTTS(kunci, kalimat);
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    if (enabled || !bicara) return;
    if (pemain) {
      try {
        pemain.pause();
        pemain.removeAttribute("src");
        pemain.load();
      } catch (error) { /* pemain sudah lepas */ }
      pemain = null;
    }
    const sintesis = window.speechSynthesis;
    if (sintesis && typeof sintesis.cancel === "function") {
      try { sintesis.cancel(); } catch (error) { /* suara sudah lepas */ }
    }
    selesai();
  }

  window.SuaraDialog = {
    ucap: ucap,
    setEnabled: setEnabled,
    enabled: function () { return enabled; },
    isBicara: function () { return bicara; },
    setPengaturDuck: function (fn) { pengaturDuck = typeof fn === "function" ? fn : null; },
  };
})();
