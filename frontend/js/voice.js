/* voice.js — wayang "ngomong" pakai suara bawaan browser (speechSynthesis).
 *
 * Tidak ada berkas audio: Chrome/Edge sudah punya voz id-ID. Tiap karakter cuma
 * beda rate/pitch. Sekali jalan satu ucapan — wayang tidak memotong bicaranya
 * sendiri, dan gamelan dikecilkan selama ia bicara.
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

  function ucap(kunci, teks) {
    const kalimat = typeof teks === "string" ? teks.trim() : "";
    if (!enabled || !kalimat || bicara) return false;
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

  function setEnabled(on) {
    enabled = Boolean(on);
    if (enabled || !bicara) return;
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
