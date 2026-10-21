/* theater.js — DOM glue panggung hidup.
 *
 * theater-core.js memutuskan babak dan efek; berkas ini yang menyentuh DOM:
 * tirai, lampu, balon, suara, debu, transisi karakter, laci, panduan.
 * Semua efek visual hanya transform/opacity.
 */
(function () {
  "use strict";

  const SOUND_KEY = "wayang-suara";
  const VOLUME_KEY = "wayang-volume";
  const DIALOG_KEY = "wayang-dialog";
  const DUST_COUNT = 12;
  const TICK_MS = 250;

  const els = {};
  let initialized = false;
  let soundOn = true;
  let dialogOn = true;
  let volume = 0.8;
  let kameraOn = true;
  let onKamera = null;
  let core = null;
  let loopTimer = null;
  let hiddenAt = 0;
  let bubbleTimer = null;
  let bubblePending = null;
  let bowTimer = null;
  let enterTimer = null;
  let pendingGong = false;
  let audioUnlocked = false;
  let lastWristAt = 0;
  const tumpukanModal = [];

  function $(id) { return document.getElementById(id); }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- init ---------- */
  function init(options) {
    if (initialized) return;
    const root = (options && options.root) || $("panggung");
    if (!root) return;
    els.root = root;
    initialized = true;
    onKamera = (options && options.onKamera) || null;

    els.kelir = $("kelir");
    els.lampu = $("lampu");
    els.debu = $("debu");
    els.balon = $("balon");
    els.pita = $("pita-terputus");
    els.pembuka = $("pembuka-kartu");
    els.pembukaJudul = $("pembuka-judul");
    els.pembukaCatatan = $("pembuka-catatan");
    els.tombolBuka = $("tombol-buka");
    els.tombolSuara = $("tombol-suara");
    els.tombolKamera = $("tombol-kamera");
    els.kontrolVolume = $("kontrol-volume");
    els.kontrolVolumeNilai = $("kontrol-volume-nilai");
    els.kontrolDialog = $("kontrol-dialog");
    els.tombolLaci = $("tombol-laci");
    els.tombolPanduan = $("tombol-panduan");
    els.tombolFullscreen = $("tombol-fullscreen");
    els.laci = $("laci-teknis");
    els.laciBackdrop = $("laci-backdrop");
    els.laciTutup = $("laci-tutup");
    els.panduan = $("panduan-overlay");
    els.panduanTutup = $("panduan-tutup");
    els.kaki = document.querySelector(".panggung-kaki");

    soundOn = readSoundPreference();
    dialogOn = readDialogPreference();
    volume = readVolumePreference();
    /* Wayang ngomong -> gamelan dikecilkan. Dipasang sekali, sebelum unlock. */
    if (window.SuaraDialog) {
      window.SuaraDialog.setPengaturDuck(function (aktif) {
        if (window.Suara) window.Suara.ducking(aktif);
      });
    }
    /* Laci tertutup masih ada di DOM: inert mencegah Tab masuk ke dalamnya. */
    if (els.laci) els.laci.inert = true;
    bindChrome();
    createDust();
    syncSoundButton();
    syncKameraButton();
    syncVolumeOutput();
    terapkanDialog();
    listenAudioUnlock();
    bindTheaterEvents();
    document.addEventListener("visibilitychange", onVisibility);

    core = createCore();
    if (core) startLoop();
    syncAmbient();
  }

  function createCore() {
    if (!window.TeaterCore || !window.Dialog) {
      console.warn("[wayang] teater tidak aktif: modul inti belum termuat.");
      return null;
    }
    const instance = window.TeaterCore.create({ dialog: window.Dialog });
    const now = performance.now();
    run(instance.init({
      character: els.root.dataset.karakter || "klasik",
      now: now,
    }));
    return instance;
  }

  function bindTheaterEvents() {
    document.addEventListener("wayang:gesture", function (event) {
      if (!core) return;
      run(core.gesture(event.detail, performance.now()));
      syncAmbient();
    });
    document.addEventListener("wayang:nohand", function () {
      if (!core) return;
      run(core.noHand(performance.now()));
      syncAmbient();
    });
    document.addEventListener("wayang:hand", function () {
      if (!core) return;
      run(core.hand(performance.now()));
      syncAmbient();
    });
    document.addEventListener("wayang:wrist", function (event) {
      if (event.detail) onWrist(event.detail.x);
    });
    document.addEventListener("wayang:connection", function (event) {
      if (!core) return;
      const state = (event.detail && event.detail.state) || "disconnected";
      run(core.connection(state, performance.now()));
      syncAmbient();
    });
  }

  /* ---------- chrome ---------- */
  function bindChrome() {
    if (els.tombolLaci) {
      els.tombolLaci.addEventListener("click", function () { setDrawer(true); });
    }
    if (els.laciTutup) {
      els.laciTutup.addEventListener("click", function () { setDrawer(false); });
    }
    if (els.laciBackdrop) {
      els.laciBackdrop.addEventListener("click", function () { setDrawer(false); });
    }
    if (els.tombolPanduan) {
      els.tombolPanduan.addEventListener("click", function () { setGuide(true); });
    }
    if (els.panduanTutup) {
      els.panduanTutup.addEventListener("click", function () { setGuide(false); });
    }
    if (els.panduan) {
      els.panduan.addEventListener("click", function (event) {
        if (event.target === els.panduan) setGuide(false);
      });
    }
    if (els.tombolSuara) {
      els.tombolSuara.addEventListener("click", function () { setSound(!soundOn); });
    }
    const tombolKamera = els.tombolKamera;
    if (tombolKamera) {
      tombolKamera.addEventListener("click", function () { mintaKamera(!kameraOn); });
    }
    if (els.kontrolVolume) {
      els.kontrolVolume.value = String(volume);
      els.kontrolVolume.addEventListener("input", function () {
        setVolume(Number(els.kontrolVolume.value));
      });
    }
    if (els.kontrolDialog) {
      els.kontrolDialog.addEventListener("click", function () { setDialog(!dialogOn); });
    }
    if (els.tombolFullscreen) {
      els.tombolFullscreen.addEventListener("click", toggleFullscreen);
    }
    if (els.tombolBuka) {
      els.tombolBuka.addEventListener("click", function () { openStage("button"); });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (els.panduan && !els.panduan.hidden) {
          setGuide(false);
          return;
        }
        if (els.laci && els.laci.classList.contains("terbuka")) {
          setDrawer(false);
          return;
        }
        if (window.Dummy && window.Dummy.isActive()) window.Dummy.setActive(false);
        return;
      }
      if (event.key === "v" || event.key === "V") {
        const target = event.target;
        if (target && target.closest && target.closest("input, textarea, select")) return;
        event.preventDefault();
        setDialog(!dialogOn);
        return;
      }
      if (event.key === "k" || event.key === "K") {
        const target = event.target;
        if (target && target.closest && target.closest("input, textarea, select")) return;
        event.preventDefault();
        mintaKamera(!kameraOn);
        return;
      }
      if (event.key === "Tab") tahanTab(event);
    });
  }

  /* ---------- modal: fokus terkunci + dikembalikan ---------- */
  function fokusDalam(panel) {
    const selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    return Array.prototype.filter.call(panel.querySelectorAll(selector), function (node) {
      return node.offsetWidth > 0 || node.offsetHeight > 0;
    });
  }

  function tahanTab(event) {
    const atas = tumpukanModal[tumpukanModal.length - 1];
    if (!atas) return;
    const daftar = fokusDalam(atas.panel);
    if (!daftar.length) {
      event.preventDefault();
      return;
    }
    const pertama = daftar[0];
    const terakhir = daftar[daftar.length - 1];
    const aktif = document.activeElement;
    if (event.shiftKey && (aktif === pertama || !daftar.includes(aktif))) {
      event.preventDefault();
      terakhir.focus();
      return;
    }
    if (!event.shiftKey && aktif === terakhir) {
      event.preventDefault();
      pertama.focus();
    }
  }

  function bukaModal(panel, fokusKe) {
    if (!panel) return;
    tumpukanModal.push({ panel: panel, sebelum: document.activeElement });
    sinkronInert();
    if (fokusKe) fokusKe.focus();
  }

  function tutupModal(panel) {
    const index = tumpukanModal.findIndex(function (entry) { return entry.panel === panel; });
    if (index === -1) return;
    const entry = tumpukanModal.splice(index, 1)[0];
    sinkronInert();
    const target = entry.sebelum;
    const aman = target && document.contains(target) && !target.closest("[inert]");
    if (aman && typeof target.focus === "function") {
      target.focus();
      return;
    }
    const atas = tumpukanModal.length ? tumpukanModal[tumpukanModal.length - 1] : null;
    if (!atas) return;
    const daftar = fokusDalam(atas.panel);
    if (daftar.length) daftar[0].focus();
  }

  /* Latar di belakang modal — dan laci yang masih tertutup — tidak bisa difokus. */
  function sinkronInert() {
    const atas = tumpukanModal.length ? tumpukanModal[tumpukanModal.length - 1].panel : null;
    const app = document.querySelector(".app");
    if (app) app.inert = Boolean(atas) && atas !== app;
    if (els.laci) {
      const terbuka = els.laci.classList.contains("terbuka");
      els.laci.inert = atas ? atas !== els.laci : !terbuka;
    }
  }

  function setDrawer(open) {
    if (!els.laci) return;
    els.laci.classList.toggle("terbuka", open);
    els.laci.setAttribute("aria-hidden", open ? "false" : "true");
    if (els.laciBackdrop) els.laciBackdrop.hidden = !open;
    if (els.tombolLaci) els.tombolLaci.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      bukaModal(els.laci, els.laciTutup);
      return;
    }
    tutupModal(els.laci);
  }

  function setGuide(open) {
    if (!els.panduan) return;
    els.panduan.hidden = !open;
    if (open) {
      bukaModal(els.panduan, els.panduanTutup);
      return;
    }
    tutupModal(els.panduan);
  }

  function toggleFullscreen() {
    const target = els.root;
    if (!target) return;
    try {
      if (!document.fullscreenElement) {
        target.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    } catch (error) {
      console.warn("[wayang] layar penuh tidak tersedia:", error);
    }
  }

  /* ---------- suara ---------- */
  function readSoundPreference() {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "mati";
    } catch (error) {
      return true;
    }
  }

  function writeSoundPreference(on) {
    try {
      window.localStorage.setItem(SOUND_KEY, on ? "nyala" : "mati");
    } catch (error) {
      /* localStorage bisa diblokir; pilihan tetap berlaku di sesi ini. */
    }
  }

  function readDialogPreference() {
    try {
      return window.localStorage.getItem(DIALOG_KEY) !== "mati";
    } catch (error) {
      return true;
    }
  }

  function writeDialogPreference(on) {
    try {
      window.localStorage.setItem(DIALOG_KEY, on ? "nyala" : "mati");
    } catch (error) {
      /* sama seperti preferensi suara: gagal simpan tidak bikin panggung macet */
    }
  }

  function readVolumePreference() {
    try {
      const mentah = window.localStorage.getItem(VOLUME_KEY);
      if (mentah === null || mentah === "") return 0.8;
      const nilai = Number(mentah);
      return Number.isFinite(nilai) && nilai >= 0 && nilai <= 1 ? nilai : 0.8;
    } catch (error) {
      return 0.8;
    }
  }

  function writeVolumePreference(nilai) {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(nilai));
    } catch (error) {
      /* sama seperti preferensi suara: gagal simpan tidak bikin panggung macet */
    }
  }

  function syncSoundButton() {
    if (!els.tombolSuara) return;
    els.tombolSuara.dataset.on = soundOn ? "true" : "false";
    els.tombolSuara.setAttribute("aria-pressed", soundOn ? "true" : "false");
    const label = soundOn ? "Matikan suara" : "Nyalakan suara";
    els.tombolSuara.setAttribute("aria-label", label);
    els.tombolSuara.title = label;
  }

  function setSound(on) {
    soundOn = Boolean(on);
    writeSoundPreference(soundOn);
    syncSoundButton();
    if (window.Suara) {
      if (soundOn) {
        unlockAudio();
        window.Suara.setEnabled(true);
      } else {
        window.Suara.setEnabled(false);
      }
    }
    terapkanDialog();
    syncAmbient();
  }

  /* Kamera dipegang backend: tombol ini cuma mengajukan niat, state akhirnya
   * ditulis lewat setCamera supaya tombol tidak bohong kalau kamera gagal buka. */
  function mintaKamera(hidup) {
    if (onKamera) {
      onKamera(hidup);
      return;
    }
    setCamera(hidup);
  }

  function setCamera(hidup) {
    kameraOn = Boolean(hidup);
    syncKameraButton();
  }

  function syncKameraButton() {
    if (!els.tombolKamera) return;
    els.tombolKamera.dataset.on = kameraOn ? "true" : "false";
    els.tombolKamera.setAttribute("aria-pressed", kameraOn ? "true" : "false");
    const label = kameraOn ? "Matikan kamera" : "Nyalakan kamera";
    els.tombolKamera.setAttribute("aria-label", label);
    els.tombolKamera.title = label;
  }

  function setVolume(nilai) {
    volume = Number.isFinite(nilai) ? Math.min(1, Math.max(0, nilai)) : volume;
    writeVolumePreference(volume);
    syncVolumeOutput();
    if (window.Suara) window.Suara.setVolume(volume);
  }

  function setDialog(on) {
    dialogOn = Boolean(on);
    writeDialogPreference(dialogOn);
    terapkanDialog();
  }

  function terapkanDialog() {
    syncDialogButton();
    if (window.SuaraDialog) window.SuaraDialog.setEnabled(soundOn && dialogOn);
  }

  function syncVolumeOutput() {
    if (els.kontrolVolume) els.kontrolVolume.value = String(volume);
    if (!els.kontrolVolumeNilai) return;
    els.kontrolVolumeNilai.textContent = volume.toFixed(2).replace(".", ",");
  }

  function syncDialogButton() {
    if (!els.kontrolDialog) return;
    const on = soundOn && dialogOn;
    els.kontrolDialog.setAttribute("aria-pressed", on ? "true" : "false");
    const label = on ? "Matikan suara dialog" : "Nyalakan suara dialog";
    els.kontrolDialog.setAttribute("aria-label", label);
    els.kontrolDialog.title = label;
  }

  function listenAudioUnlock() {
    const unlock = function () { unlockAudio(); };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    terapkanDialog();
    if (!window.Suara) return;
    window.Suara.setEnabled(soundOn);
    window.Suara.unlock();
    window.Suara.setVolume(volume);
    if (pendingGong && soundOn) {
      pendingGong = false;
      window.Suara.play("buka");
    }
    syncAmbient();
  }

  function syncAmbient() {
    if (!window.Suara) return;
    const act = core ? core.state() : "pembuka";
    const connected = core ? core.snapshot().connected : true;
    const on = soundOn && audioUnlocked && !document.hidden && connected
      && (act === "live" || act === "jeda");
    window.Suara.musik(on, act === "jeda" ? "jeda" : "panggung");
  }

  /* ---------- debu ---------- */
  function createDust() {
    if (!els.debu || prefersReducedMotion()) return;
    els.debu.textContent = "";
    for (let index = 0; index < DUST_COUNT; index += 1) {
      const mote = document.createElement("i");
      mote.style.left = (4 + Math.random() * 92).toFixed(1) + "%";
      mote.style.top = (18 + Math.random() * 74).toFixed(1) + "%";
      mote.style.animationDuration = (10 + Math.random() * 8).toFixed(1) + "s";
      mote.style.animationDelay = (-Math.random() * 18).toFixed(1) + "s";
      mote.style.opacity = (0.25 + Math.random() * 0.5).toFixed(2);
      els.debu.appendChild(mote);
    }
  }

  /* ---------- loop ---------- */
  function startLoop() {
    if (loopTimer !== null) return;
    loopTimer = setInterval(function () {
      if (!core || document.hidden) return;
      run(core.tick(performance.now()));
      syncAmbient();
    }, TICK_MS);
  }

  function stopLoop() {
    if (loopTimer !== null) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
  }

  function onVisibility() {
    if (document.hidden) {
      hiddenAt = performance.now();
      stopLoop();
      syncAmbient();
      return;
    }
    const now = performance.now();
    if (hiddenAt && core) core.shift(now - hiddenAt);
    hiddenAt = 0;
    startLoop();
    syncAmbient();
  }

  /* ---------- pembuka / istirahat ---------- */
  function openStage(source) {
    if (core) {
      run(core.open(source, performance.now()));
      syncAmbient();
      return;
    }
    document.dispatchEvent(new CustomEvent("teater:open", { detail: { source: source } }));
  }

  function showOpeningCard() {
    if (!els.pembuka) return;
    els.pembuka.hidden = false;
    if (els.pembukaJudul) els.pembukaJudul.textContent = "Tunjukkan telapak tangan";
    if (els.pembukaCatatan) {
      els.pembukaCatatan.textContent = "gestur apa pun yang terbaca akan membuka tirai";
    }
    if (els.tombolBuka) {
      els.tombolBuka.hidden = false;
      els.tombolBuka.disabled = false;
    }
  }

  function showRestCard() {
    if (!els.pembuka) return;
    els.pembuka.hidden = false;
    if (els.pembukaJudul) els.pembukaJudul.textContent = "Panggung istirahat";
    if (els.pembukaCatatan) {
      els.pembukaCatatan.textContent = "tunjukkan tangan untuk membangunkan";
    }
    if (els.tombolBuka) els.tombolBuka.hidden = true;
  }

  function hideOpeningCard() {
    if (els.pembuka) els.pembuka.hidden = true;
  }

  function fail(message) {
    if (!els.pembuka) return;
    els.pembuka.hidden = false;
    if (els.pembukaJudul) els.pembukaJudul.textContent = "Panggung gagal dimuat";
    if (els.pembukaCatatan) els.pembukaCatatan.textContent = message || "wayang.svg tidak bisa dimuat.";
    if (els.tombolBuka) els.tombolBuka.disabled = true;
  }

  /* ---------- eksekutor efek ---------- */
  function run(result) {
    syncKaki();
    if (!result || !result.effects) return;
    result.effects.forEach(execute);
  }

  /* Data teknis mundur kalau panggung lagi menunggu atau tidur. */
  function syncKaki() {
    if (!els.kaki || !core) return;
    const act = core.state();
    els.kaki.classList.toggle("redup", act !== "live");
  }

  function execute(effect) {
    if (!effect) return;
    switch (effect.type) {
      case "bubble": showBubble(effect); break;
      case "curtain": setCurtain(effect); break;
      case "light": setLight(effect); break;
      case "idle": setIdle(effect.on); break;
      case "sound": playSound(effect.cue); break;
      case "ambient": playAmbient(); break;
      case "bow": bow(); break;
      case "ribbon": setRibbon(effect.visible); break;
      case "character": setCharacterColor(effect.key); break;
      case "exit-character": exitAnimation(); break;
      case "enter-character": enterAnimation(effect.character); break;
      default: break;
    }
  }

  function setCurtain(effect) {
    if (!els.root) return;
    if (effect.half) {
      els.root.dataset.tirai = "setengah";
      return;
    }
    els.root.dataset.tirai = effect.open ? "terbuka" : "tutup";
    if (effect.open) {
      hideOpeningCard();
    } else if (core && core.state() === "tidur") {
      showRestCard();
    } else {
      showOpeningCard();
    }
  }

  function setLight(effect) {
    if (!els.lampu) return;
    els.lampu.dataset.level = effect.level || "full";
    if (effect.level === "dim" || effect.level === "bright") {
      els.lampu.style.transitionDuration = (effect.level === "dim" ? 1500 : 1200) + "ms";
    } else {
      els.lampu.style.transitionDuration = "";
    }
  }

  /* Efek teater dipakai semua wayang di panggung (1 atau 2 pemain).
   * Pakai class, bukan ID: tiap instans SVG di-prefix sehingga ID-nya beda. */
  function semuaHidup() {
    return els.root ? Array.prototype.slice.call(els.root.querySelectorAll(".grup-hidup")) : [];
  }

  function semuaBayangan() {
    return els.root ? Array.prototype.slice.call(els.root.querySelectorAll(".bayangan-wayang")) : [];
  }

  function setIdle(on) {
    semuaHidup().forEach(function (hidup) {
      hidup.classList.toggle("idle", Boolean(on));
    });
  }

  function showBubble(effect) {
    if (!els.balon || !effect.text) return;
    const delay = Number(effect.delay) || 0;
    clearTimeout(bubblePending);
    if (delay > 0) {
      bubblePending = setTimeout(function () { paintBubble(effect); }, delay);
    } else {
      paintBubble(effect);
    }
  }

  function paintBubble(effect) {
    if (!els.balon) return;
    clearTimeout(bubbleTimer);
    els.balon.textContent = effect.text;
    els.balon.hidden = false;
    els.balon.classList.remove("tampil");
    void els.balon.offsetWidth;
    els.balon.classList.add("tampil");
    ucapkanBalon(effect.text);
    const duration = Number(effect.ms) || 3800;
    bubbleTimer = setTimeout(function () {
      els.balon.classList.remove("tampil");
      bubbleTimer = setTimeout(function () { els.balon.hidden = true; }, 320);
    }, duration);
  }

  /* Balon Player 1 yang diucapkan: narasi panggung tetap satu suara
   * walaupun dua wayang bergerak. */
  function ucapkanBalon(teks) {
    if (!window.SuaraDialog || !soundOn || !dialogOn || !audioUnlocked) return;
    const kunci = (els.root && els.root.dataset.karakter) || "klasik";
    window.SuaraDialog.ucap(kunci, teks);
  }

  function playSound(cue) {
    if (!cue || !soundOn) return;
    if (!audioUnlocked) {
      if (cue === "buka") pendingGong = true;
      return;
    }
    if (window.Suara) window.Suara.play(cue);
  }

  function playAmbient() {
    if (prefersReducedMotion()) return;
    if (Math.random() < 0.55) flashDust();
    else swayShadow();
  }

  function flashDust() {
    if (!els.debu) return;
    const motes = els.debu.querySelectorAll("i");
    if (!motes.length) return;
    for (let index = 0; index < 4; index += 1) {
      const mote = motes[Math.floor(Math.random() * motes.length)];
      mote.classList.remove("kilat");
      void mote.offsetWidth;
      mote.classList.add("kilat");
      setTimeout(function () { mote.classList.remove("kilat"); }, 1700);
    }
  }

  function swayShadow() {
    semuaBayangan().forEach(function (shadow) {
      shadow.classList.remove("ayun");
      void shadow.getBoundingClientRect();
      shadow.classList.add("ayun");
      setTimeout(function () { shadow.classList.remove("ayun"); }, 2500);
    });
  }

  function bow() {
    if (!els.root || prefersReducedMotion()) return;
    const semua = semuaHidup();
    if (!semua.length) return;
    clearTimeout(bowTimer);
    semua.forEach(function (hidup) { hidup.classList.add("membungkuk"); });
    bowTimer = setTimeout(function () {
      semua.forEach(function (hidup) { hidup.classList.remove("membungkuk"); });
    }, 900);
  }

  function setRibbon(visible) {
    if (els.pita) els.pita.hidden = !visible;
  }

  function setCharacterColor(key) {
    if (els.root) els.root.dataset.karakter = key || "klasik";
  }

  /* ---------- transisi karakter ---------- */
  function exitAnimation() {
    semuaHidup().forEach(function (hidup) {
      hidup.classList.remove("idle", "membungkuk");
      hidup.style.transition = prefersReducedMotion()
        ? "none"
        : "transform 900ms cubic-bezier(0.4, 0.02, 0.2, 1), opacity 900ms ease";
      hidup.style.transform = "rotate(4deg)";
      hidup.style.opacity = "0";
    });
  }

  function enterAnimation(key) {
    setCharacterColor(key);
    const semua = semuaHidup();
    if (!semua.length) return;
    clearTimeout(enterTimer);
    const from = els.root.dataset.arah === "kiri" ? 40 : -40;
    semua.forEach(function (hidup) {
      hidup.classList.remove("idle", "membungkuk");
      hidup.style.transition = "none";
      hidup.style.opacity = "0";
      hidup.style.transform = "translateX(" + from + "px)";
      void hidup.getBoundingClientRect();
      if (!prefersReducedMotion()) {
        hidup.style.transition = "transform 900ms cubic-bezier(0.4, 0.02, 0.2, 1), opacity 900ms ease";
      }
      hidup.style.transform = "translateX(0)";
      hidup.style.opacity = "1";
    });
    enterTimer = setTimeout(function () {
      semua.forEach(function (hidup) {
        hidup.style.transition = "";
        hidup.style.transform = "";
        hidup.style.opacity = "";
        if (core && core.state() === "jeda") hidup.classList.add("idle");
      });
    }, prefersReducedMotion() ? 0 : 900);
  }

  /* ---------- sorot telunjuk ---------- */
  function onWrist(x) {
    if (!els.lampu) return;
    const value = Number(x);
    if (!Number.isFinite(value)) return;
    const now = performance.now();
    if (now - lastWristAt < 80) return;
    lastWristAt = now;
    const clamped = Math.max(0.2, Math.min(0.8, value));
    els.lampu.style.setProperty("--sorot-x", (clamped * 100).toFixed(1) + "%");
  }

  /* ---------- API publik ---------- */
  window.Teater = {
    init: init,
    state: function () { return core ? core.state() : "pembuka"; },
    isBusy: function () { return core ? core.snapshot().busy : false; },
    exitCharacter: function () {
      if (!core) return Promise.resolve();
      run(core.exitCharacter(performance.now()));
      return new Promise(function (resolve) {
        setTimeout(resolve, prefersReducedMotion() ? 0 : 900);
      });
    },
    setCharacter: function (key) {
      if (!core) {
        setCharacterColor(key);
        return;
      }
      run(core.setCharacter(key, performance.now()));
    },
    setSound: setSound,
    setCamera: setCamera,
    fail: fail,
    onWrist: onWrist,
  };
})();
