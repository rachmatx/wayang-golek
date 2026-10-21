/* app.js — otak halaman: pegang state, sambungkan semua modul.
 *
 * Aturan main (Rancangan Bab 3.5):
 *  - gestur BARU          -> jalankan pose
 *  - gestur SAMA          -> jangan ulang animasi (kecuali telunjuk: ikuti wrist_x)
 *  - state unknown        -> pose tidak diubah, panel minta tahan pose
 *  - tangan hilang        -> hitung mundur 1 detik, lalu wayang itu kembali netral
 *  - websocket putus      -> wayang diam di pose terakhir, sambung ulang otomatis
 *
 * Dua tangan / dua pemain (bagian "panggung kembar"):
 *  - backend mengirim message.hands[] dengan id tangan yang stabil
 *  - slots.js memutuskan tangan mana pegang wayang ke berapa
 *  - tiap pemain punya wayang, pose, timer dan strip sendiri
 *  - teater (tirai, balon, suara, dialog dalang) tetap satu: dipicu pemain mana
 *    pun yang beraksi, warna lampu ikut pemain 1
 */
(function () {
  "use strict";

  const MAX_PEMAIN = 2;

  const DUMMY_CONFIDENCE = {
    telapak_terbuka: 0.93,
    kepalan: 0.90,
    telunjuk: 0.88,
    dua_jari: 0.95,
    jempol: 0.86,
    ok: 0.91,
    netral: 1,
  };

  const NO_HAND_RESET_MS = 1000;

  const CHARACTERS = {
    klasik: { file: "assets/wayang.svg", label: "Klasik" },
    arjuna: { file: "assets/wayang-arjuna.svg", label: "Arjuna" },
    gatotkaca: { file: "assets/wayang-gatotkaca.svg", label: "Gatotkaca" },
    cepot: { file: "assets/wayang-cepot.svg", label: "Cepot" },
  };

  const AWAL = ["klasik", "cepot"];

  const app = {
    source: "live",
    jumlah: 1,
    focus: 0,
    ws: null,
    healthTimer: null,
    cameraStreaming: false,
    characterLoading: false,
    threshold: 0.6,
    slots: null,
    players: [],
  };

  const $ = function (id) { return document.getElementById(id); };

  document.addEventListener("DOMContentLoaded", boot);

  function buatPemain(index) {
    const container = $("kelir-" + index);
    const pemain = {
      index: index,
      container: container,
      wayang: window.Wayang ? window.Wayang.createPlayer(container, index) : null,
      karakter: AWAL[index] || "klasik",
      loaded: false,
      gesture: null,
      lastGesture: null,
      handPresent: false,
      noHandTimer: null,
      autoTimer: null,
    };
    if (pemain.wayang) {
      pemain.wayang.onFacingChange(function (value) { setFacingLabel(index, value); });
    }
    return pemain;
  }

  async function boot() {
    Panel.init();
    Panel.setThreshold(app.threshold);
    app.slots = window.createSlots({ jumlah: 1 });
    app.players = [];
    for (let i = 0; i < MAX_PEMAIN; i += 1) app.players.push(buatPemain(i));

    Dummy.init({ onGesture: onDummyGesture, onToggle: onDummyToggle });
    Dummy.setJumlah(app.jumlah);
    if (window.Teater) Teater.init({ root: $("panggung") });

    bindPanduan();
    bindKontrol();
    bindKamera();
    connectWS();
    pollHealth();

    await Wayang.loadMap("/api/gesture-map");
    const loading = $("kelir-loading");
    if (loading) loading.remove();
    await muatPemain(app.players[0]);

    buildPanduan();
    Dummy.rebuild();
    setFacingLabel(0, app.players[0].wayang ? app.players[0].wayang.facing() : 1);
  }

  async function muatPemain(pemain, key) {
    if (!pemain.wayang || !pemain.container) return false;
    const karakter = CHARACTERS[key || pemain.karakter] || CHARACTERS.klasik;
    try {
      await pemain.wayang.load(karakter.file, {
        pose: "netral",
        facing: pemain.index === 1 ? -1 : 1,
      });
      pemain.loaded = true;
      return true;
    } catch (error) {
      console.error("[wayang] gagal memuat " + karakter.label + " untuk pemain " + (pemain.index + 1) + ":", error);
      if (pemain.index === 0) {
        Panel.setHint("wayang.svg gagal dimuat — jalankan halaman lewat backend (http://127.0.0.1:8000)");
        if (window.Teater && Teater.fail) {
          Teater.fail("wayang gagal dimuat. Jalankan lewat backend lalu muat ulang halaman.");
        }
      }
      return false;
    }
  }

  /* ---------- jumlah wayang di panggung ---------- */
  async function setJumlah(banyak, button) {
    const jumlah = Math.max(1, Math.min(MAX_PEMAIN, Number(banyak) || 1));
    if (jumlah === app.jumlah) return;
    if (app.characterLoading) return;

    app.jumlah = jumlah;
    app.slots.setJumlah(jumlah);
    app.focus = 0;

    const kelir = $("kelir");
    if (kelir) kelir.dataset.jumlah = String(jumlah);

    kontrolPemain(jumlah, button);
    Panel.setJumlah(jumlah);
    Dummy.setJumlah(jumlah);

    if (jumlah === MAX_PEMAIN && !app.players[1].loaded) {
      app.characterLoading = true;
      await muatPemain(app.players[1]);
      app.characterLoading = false;
    }

    for (let i = 0; i < MAX_PEMAIN; i += 1) resetPemain(app.players[i], i >= jumlah);
  }

  function kontrolPemain(jumlah, button) {
    const segmen = $("kontrol-jumlah");
    if (segmen && button) {
      Array.prototype.forEach.call(segmen.children, function (child) {
        const aktif = child === button;
        child.classList.toggle("aktif", aktif);
        child.setAttribute("aria-pressed", aktif ? "true" : "false");
      });
    }
    for (let i = 1; i < MAX_PEMAIN; i += 1) {
      const tray = $("kontrol-wayang-" + i);
      const label = $("tray-label-" + i);
      if (tray) tray.hidden = i >= jumlah;
      if (label) label.hidden = i >= jumlah;
      const slot = $("kelir-" + i);
      if (slot) slot.hidden = i >= jumlah;
    }
  }

  /* Panggung berubah jumlah: bersikan state gestur supaya timer lama tidak
   * menimpa wayang yang baru. */
  function resetPemain(pemain, diam) {
    cancelNeutral(pemain);
    cancelAuto(pemain);
    pemain.gesture = null;
    pemain.lastGesture = null;
    pemain.handPresent = false;
    if (!pemain.wayang) return;
    pemain.wayang.applyPose("netral", true);
    pemain.wayang.setWrist(0.5);
    if (diam) {
      setFacingLabel(pemain.index, 1);
      return;
    }
    setStrip(pemain.index, { gesture: null, confidence: 0 });
    if (pemain.index === 0) emitWrist(0.5);
  }

  /* ---------- koneksi ---------- */
  function connectWS() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const host = location.host || "localhost:8000";
    app.ws = createWSClient({
      url: protocol + "://" + host + "/ws/predict",
      onMessage: onSocketMessage,
      onStatus: onSocketStatus,
    });
    app.ws.connect();
  }

  function onSocketStatus(status) {
    Panel.setConnection(status);
    const ribbon = $("pita-terputus");
    if (status === "connected") {
      if (ribbon) ribbon.hidden = true;
      document.dispatchEvent(new CustomEvent("wayang:connection", { detail: { state: "connected" } }));
      if (app.source !== "dummy" && !adaGesturAktif()) {
        Panel.setHint("menunggu tangan terdeteksi…");
      }
    } else if (status === "disconnected") {
      if (ribbon) ribbon.hidden = false;
      document.dispatchEvent(new CustomEvent("wayang:connection", { detail: { state: "disconnected" } }));
      if (app.source === "live") {
        Panel.setHint("backend terputus — wayang diam di pose terakhir");
        Panel.setResultState("unknown");
      }
    }
  }

  function adaGesturAktif() {
    return app.players.some(function (pemain) { return pemain.gesture !== null; });
  }

  function onSocketMessage(message) {
    if (!message || message.type === "ack" || message.type === "pong") return;
    if (app.source === "dummy") return;
    handlePrediction(message);
  }

  /* ---------- pesan prediksi ---------- */
  function handlePrediction(message) {
    const hands = Array.isArray(message.hands) ? message.hands : [];

    Panel.setCamera(message.camera);
    Panel.setMeta(message.model, message.fps, message.model_loaded);

    const penugasan = app.slots.assign(hands);
    const perSlot = new Map();
    hands.forEach(function (hand, i) {
      const slot = penugasan[i];
      if (slot >= 0 && slot < app.jumlah && !perSlot.has(slot)) perSlot.set(slot, hand);
    });

    Panel.setLandmarks(hands.map(function (hand, i) {
      const slot = penugasan[i];
      return { index: slot >= 0 ? slot : i % MAX_PEMAIN, landmarks: hand.landmarks };
    }));

    for (let i = 0; i < app.jumlah; i += 1) {
      prosesTangan(app.players[i], perSlot.get(i) || null, message);
    }

    Panel.setFocus(app.focus);
    laporkanFokus(hands, perSlot);
  }

  function prosesTangan(pemain, hand, message) {
    const index = pemain.index;

    if (!hand) {
      if (pemain.handPresent) {
        pemain.handPresent = false;
        document.dispatchEvent(new CustomEvent("wayang:nohand", { detail: { player: index } }));
      }
      setStrip(index, { gesture: null, confidence: 0 });
      scheduleNeutral(pemain);
      return;
    }

    cancelNeutral(pemain);
    setStrip(index, { confidence: hand.confidence });

    if (hand.state !== "ok" || !hand.gesture) {
      if (message.model_loaded === false) {
        Panel.setHint("model P2 belum terpasang — backend kirim state unknown");
      } else if (message.camera === false) {
        Panel.setHint("kamera tidak tersedia — coba mode dummy (tombol D)");
      } else {
        Panel.setHint("pemain " + (index + 1) + " ragu — tahan pose tangan sebentar");
      }
      return;
    }

    if (!pemain.handPresent) {
      pemain.handPresent = true;
      document.dispatchEvent(new CustomEvent("wayang:hand", { detail: { player: index } }));
    }

    const sama = hand.gesture === pemain.lastGesture;
    pemain.lastGesture = hand.gesture;
    if (sama) {
      // Gestur sama: jangan mulai ulang animasi. Dibandingkan dengan gestur
      // terakhir dari kamera (bukan pose aktif) supaya pose auto seperti
      // jempol tidak terpicu lagi tepat setelah kembali netral.
      if (hand.gesture === "telunjuk") {
        pemain.wayang.setWrist(hand.wrist_x);
        if (index === 0) emitWrist(hand.wrist_x);
      }
      return;
    }

    app.focus = index;
    activateGesture(pemain, hand.gesture, hand.wrist_x, "live", hand.confidence);
  }

  /* Kartu "Hasil Bacaan" mengikuti pemain yang terakhir beraksi. */
  function laporkanFokus(hands, perSlot) {
    const fokus = perSlot.get(app.focus) || null;

    if (!hands.length) {
      Panel.setResultState("no_hand");
      Panel.setTop3([]);
      Panel.setConfidence(0);
      Panel.setHint("tidak ada tangan terdeteksi");
      return;
    }
    if (!fokus) {
      Panel.setResultState("no_hand");
      return;
    }
    Panel.setResultState(fokus.state);
    Panel.setConfidence(fokus.confidence);
    if (Array.isArray(fokus.top3)) Panel.setTop3(fokus.top3);
    if (fokus.state === "ok") Panel.setGestureLabel(fokus.gesture);
  }

  /* ---------- gestur -> pose ---------- */
  function activateGesture(pemain, gesture, wrist, source, confidence) {
    cancelAuto(pemain);
    const index = pemain.index;
    const from = source || app.source;

    if (gesture === "netral") {
      pemain.gesture = "netral";
      pemain.wayang.applyPose("netral", true);
      pemain.wayang.setWrist(0.5);
      if (index === 0) emitWrist(0.5);
      setStrip(index, { gesture: "netral", confidence: confidence });
      emitGesture(gesture, from, confidence, index);
      return;
    }

    const pose = Wayang.poseFor(gesture);
    if (pose.mode === "toggle") {
      pemain.wayang.toggleFacing();
      pemain.wayang.applyPose(gesture);
    } else {
      pemain.wayang.applyPose(gesture);
    }

    const nilaiWrist = gesture === "telunjuk" ? wrist : 0.5;
    pemain.wayang.setWrist(nilaiWrist);
    if (index === 0) emitWrist(nilaiWrist);

    if (pose.mode === "auto") {
      pemain.autoTimer = setTimeout(function () {
        pemain.autoTimer = null;
        if (pemain.gesture === gesture) {
          if (index === app.focus) {
            Panel.setConfidence(0);
            Panel.setTop3([]);
          }
          activateGesture(pemain, "netral", 0.5, from, 0);
          return;
        }
      }, pose.resetMs || 1000);
    }

    pemain.gesture = gesture;
    setStrip(index, { gesture: gesture, confidence: confidence });
    if (index === app.focus) Panel.setGestureLabel(gesture);
    emitGesture(gesture, from, confidence, index);
  }

  function emitGesture(gesture, source, confidence, player) {
    document.dispatchEvent(new CustomEvent("wayang:gesture", {
      detail: {
        gesture: gesture,
        source: source || app.source,
        confidence: Number(confidence) || 0,
        player: player,
      },
    }));
  }

  /* Sorot telunjuk cuma satu berkas, jadi ikut pemain 1. */
  function emitWrist(x) {
    const value = Number(x);
    if (!Number.isFinite(value)) return;
    document.dispatchEvent(new CustomEvent("wayang:wrist", { detail: { x: value } }));
  }

  function scheduleNeutral(pemain) {
    if (pemain.noHandTimer) return;
    pemain.noHandTimer = setTimeout(function () {
      pemain.noHandTimer = null;
      pemain.lastGesture = null;
      if (pemain.gesture !== "netral") activateGesture(pemain, "netral", 0.5, "live", 0);
    }, NO_HAND_RESET_MS);
  }

  function cancelNeutral(pemain) {
    if (pemain.noHandTimer) {
      clearTimeout(pemain.noHandTimer);
      pemain.noHandTimer = null;
    }
  }

  function cancelAuto(pemain) {
    if (pemain.autoTimer) {
      clearTimeout(pemain.autoTimer);
      pemain.autoTimer = null;
    }
  }

  /* ---------- mode dummy ---------- */
  function onDummyGesture(payload) {
    const gesture = payload.gesture;
    const pemain = app.players[payload.player] || app.players[0];
    if (!gesture || !pemain.wayang || !pemain.loaded) return;

    Panel.setLandmarks([]);
    Panel.setFocus(pemain.index);
    Panel.setResultState("ok");
    Panel.setMeta("dummy", 0, true);
    Panel.setTop3([[gesture === "netral" ? "netral" : gesture, 1]]);
    const confidence = gesture === "netral" ? 1 : (DUMMY_CONFIDENCE[gesture] || 0.9);
    Panel.setConfidence(confidence);
    Panel.setHint("mode dummy — gestur dari tombol, bukan kamera");

    app.focus = pemain.index;
    if (gesture === pemain.gesture && gesture !== "telunjuk") return;
    activateGesture(pemain, gesture, payload.wrist, "dummy", confidence);
  }

  function onDummyToggle(active) {
    app.source = active ? "dummy" : "live";
    app.players.forEach(function (pemain) { pemain.lastGesture = null; });
    const badge = $("panggung-badge");
    if (badge) badge.hidden = !active;
    const tombol = $("kontrol-dummy");
    if (tombol) tombol.textContent = active ? "Keluar mode dummy" : "Mode dummy (D)";

    if (active) {
      /* Jangan biarkan timer "tangan hilang" dari mode live mereset pose
       * dummy yang baru dipilih. */
      app.players.forEach(function (pemain) {
        cancelNeutral(pemain);
        cancelAuto(pemain);
      });
      Panel.setHint("mode dummy — pilih gestur lewat tombol atau angka 1–6");
    } else {
      app.players.forEach(cancelNeutral);
      Panel.setHint("menunggu data prediksi…");
    }
  }

  /* ---------- UI ---------- */
  function setStrip(index, data) {
    Panel.setStrip(index, data);
  }

  function setFacingLabel(index, facing) {
    const node = $("panggung-arah-" + index);
    if (node) {
      const teks = facing < 0 ? "kiri" : "kanan";
      node.textContent = teks;
      node.setAttribute("aria-label", "menghadap " + teks);
    }
    if (index !== 0) return;
    const stage = $("panggung");
    if (stage) stage.dataset.arah = facing < 0 ? "kiri" : "kanan";
  }

  function bindPanduan() {
    buildPanduan();
  }

  function buildPanduan() {
    const wrap = $("panduan-isi");
    if (!wrap) return;
    const items = Wayang.gestures();
    wrap.innerHTML = items.map(function (item, index) {
      return (
        '<div class="panduan-item">' +
          (window.Glif ? window.Glif.tangan(item.id) : "") +
          '<span class="panduan-kunci">' + (index + 1) + "</span>" +
          '<div class="panduan-teks">' +
            "<strong>" + escapeHtml(item.label) + "</strong>" +
            "<span>" + escapeHtml(item.hint || "") + "</span>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function bindKontrol() {
    const jumlahSegmen = $("kontrol-jumlah");
    if (jumlahSegmen) {
      jumlahSegmen.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-jumlah]");
        if (!button || button.disabled) return;
        setJumlah(Number.parseInt(button.dataset.jumlah, 10), button);
      });
    }

    for (let i = 0; i < MAX_PEMAIN; i += 1) bindTrayPemain(i);

    const segmen = $("kontrol-model");
    if (segmen) {
      segmen.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-model]");
        if (!button || button.disabled) return;
        Array.prototype.forEach.call(segmen.children, function (child) {
          child.classList.toggle("aktif", child === button);
        });
        if (app.ws) app.ws.send({ command: "set_model", model: button.dataset.model });
      });
    }

    const ambang = $("kontrol-ambang");
    if (ambang) {
      ambang.addEventListener("input", function () {
        const value = Number.parseFloat(ambang.value);
        app.threshold = value;
        Panel.setThreshold(value);
        const output = $("kontrol-ambang-nilai");
        if (output) output.textContent = value.toFixed(2).replace(".", ",");
        if (app.ws) app.ws.send({ command: "set_threshold", value: value });
      });
    }

    const dummy = $("kontrol-dummy");
    if (dummy) {
      dummy.addEventListener("click", function () { Dummy.toggle(); });
    }
  }

  function bindTrayPemain(index) {
    const tray = $("kontrol-wayang-" + index);
    if (!tray) return;
    tray.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-wayang]");
      if (!button || button.disabled) return;
      selectCharacter(index, button.dataset.wayang, button);
    });
  }

  async function selectCharacter(index, key, button) {
    const karakter = CHARACTERS[key];
    const pemain = app.players[index];
    if (!karakter || !pemain || key === pemain.karakter || app.characterLoading) return;
    if (window.Teater && Teater.isBusy && Teater.isBusy()) return;

    app.characterLoading = true;
    const teater = window.Teater;
    const state = teater && teater.state ? teater.state() : "live";
    const tampil = state === "live" || state === "jeda";
    const lama = pemain.karakter;
    /* Hanya pemain 1 yang punya narasi dalang (keluar-masuk panggung, balon,
     * suara, warna lampu): pemain 2 cukup ganti kulit wayang. */
    const dalang = index === 0 && teater;

    try {
      if (dalang && tampil && teater.exitCharacter) await teater.exitCharacter();
      const sukses = await muatPemain(pemain, key);
      if (!sukses) throw new Error("gagal memuat " + karakter.file);
      pemain.karakter = key;
      markTray(index, button);
      if (dalang) teater.setCharacter(key);
    } catch (error) {
      console.error("[wayang] gagal memuat " + karakter.label + ":", error);
      Panel.setHint("wayang " + karakter.label + " gagal dimuat");
      await muatPemain(pemain, lama);
      if (dalang) teater.setCharacter(lama);
    } finally {
      app.characterLoading = false;
    }
  }

  function markTray(index, button) {
    if (!button || !button.parentNode) return;
    Array.prototype.forEach.call(button.parentNode.children, function (child) {
      child.classList.toggle("aktif", child === button);
    });
  }

  /* ---------- kesehatan backend + gambar kamera ---------- */
  function bindKamera() {
    const img = $("video-feed");
    if (!img) return;
    img.addEventListener("error", function () {
      // Siaran MJPEG berhenti / kamera mati: tampilkan gambar pengganti.
      app.cameraStreaming = false;
      img.src = "assets/kamera-off.svg";
    });
  }

  async function pollHealth() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      applyHealth(data);
    } catch (error) {
      Panel.setCamera(null);
    }
    clearTimeout(app.healthTimer);
    app.healthTimer = setTimeout(pollHealth, 4000);
  }

  function applyHealth(data) {
    Panel.setCamera(data.camera);
    const img = $("video-feed");
    if (!img) return;

    if (data.camera === true && !app.cameraStreaming) {
      app.cameraStreaming = true;
      img.src = "/video_feed?t=" + Date.now();
    } else if (data.camera !== true && app.cameraStreaming) {
      app.cameraStreaming = false;
      img.src = "assets/kamera-off.svg";
    }

    const models = (data.components && data.components.models) || [];
    const rfButton = document.querySelector('#kontrol-model button[data-model="rf"]');
    if (rfButton && models.length) {
      rfButton.disabled = models.indexOf("rf") === -1;
      rfButton.title = rfButton.disabled ? "model RF belum ada di folder models/" : "";
    }

    if (data.model_loaded === false && app.source === "live") {
      Panel.setHint("model P2 belum terpasang — backend jalan tanpa model, coba mode dummy (D)");
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
