/* dummy.js — mode dummy: tombol + keyboard mengirim gestur palsu ke mesin animasi.
 *
 * Tidak lewat WebSocket: gestur langsung diteruskan ke app.js, sama seperti
 * pesan prediksi asli. Jadi demo tetap jalan walau kamera/model bermasalah.
 *
 * Dua pemain: bar dummy punya pemilih pemain (P1 / P2). Tombol dan angka 1–6
 * selalu mengirim ke pemain yang sedang dipilih; tombol P mengganti pemain.
 */
(function () {
  "use strict";

  let onGesture = function () {};
  let onToggle = function () {};
  let active = false;
  let jumlah = 1;
  let pemain = 0;
  let root = null;
  let tombolWrap = null;
  let pemainWrap = null;
  const ticks = [null, null];
  const clock = [0, 0];

  function list() {
    return window.Wayang ? window.Wayang.gestures() : [];
  }

  /* Bar bawah cuma muat label pendek; label lengkap tetap ada di title/aria-label. */
  const PENDEK = {
    telapak_terbuka: "Telapak",
    kepalan: "Kepalan",
    telunjuk: "Telunjuk",
    dua_jari: "Dua Jari",
    jempol: "Jempol",
    ok: "OK",
  };

  function shortLabel(item) {
    return PENDEK[item.id] || String(item.label).split(" ")[0];
  }

  function init(options) {
    options = options || {};
    onGesture = options.onGesture || onGesture;
    onToggle = options.onToggle || onToggle;

    root = document.getElementById("dummy");
    tombolWrap = document.getElementById("dummy-tombol");
    pemainWrap = document.getElementById("dummy-pemain");
    if (!root || !tombolWrap) return;

    const close = document.getElementById("dummy-tutup");
    if (close) close.addEventListener("click", function () { setActive(false); });

    if (pemainWrap) {
      pemainWrap.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-pemain]");
        if (!button || button.disabled) return;
        setPemain(Number.parseInt(button.dataset.pemain, 10));
      });
    }

    build();
    markPemain();
    document.addEventListener("keydown", onKeyDown);
  }

  function build() {
    if (!tombolWrap) return;
    const items = list();
    const buttons = items.map(function (item, index) {
      return (
        '<button type="button" data-gesture="' + item.id + '"' +
          ' data-kunci="' + (index + 1) + '"' +
          ' title="' + escapeHtml(item.label) + '"' +
          ' aria-label="Kirim gestur ' + escapeHtml(item.label) + ', tombol ' + (index + 1) + '">' +
          "<span>" + escapeHtml(shortLabel(item)) + "</span>" +
        "</button>"
      );
    });
    buttons.push(
      '<button type="button" data-gesture="netral"' +
        ' data-kunci="0" title="Netral" aria-label="Kirim gestur Netral, tombol 0">' +
        "<span>Netral</span>" +
      "</button>"
    );
    tombolWrap.innerHTML = buttons.join("");

    tombolWrap.onclick = function (event) {
      const button = event.target.closest("button[data-gesture]");
      if (!button) return;
      emit(button.dataset.gesture);
    };
  }

  function rebuild() {
    build();
  }

  /* ---------- pemain aktif ---------- */
  function setPemain(index) {
    const baru = Number.isFinite(index) ? index : 0;
    pemain = baru > 0 && jumlah > 1 ? 1 : 0;
    markPemain();
    return pemain;
  }

  function markPemain() {
    if (!pemainWrap) return;
    Array.prototype.forEach.call(pemainWrap.querySelectorAll("button[data-pemain]"), function (button) {
      const nilai = Number.parseInt(button.dataset.pemain, 10);
      button.classList.toggle("aktif", nilai === pemain);
      button.setAttribute("aria-pressed", nilai === pemain ? "true" : "false");
    });
  }

  /* Jumlah wayang di panggung: P2 hanya bisa dipilih kalau panggung dua wayang. */
  function setJumlah(banyak) {
    jumlah = Math.max(1, Number(banyak) || 1);
    if (pemainWrap) {
      const tombolDua = pemainWrap.querySelector('button[data-pemain="1"]');
      if (tombolDua) {
        tombolDua.disabled = jumlah < 2;
        tombolDua.title = jumlah < 2 ? "pilih panggung 2 wayang dulu" : "";
      }
    }
    if (jumlah < 2 && pemain !== 0) setPemain(0);
    else markPemain();
  }

  function setActive(value) {
    // Bar-nya di-hidden, jadi fokus di dalamnya harus dicarikan tetangga.
    const fokusDiDalam = root && !root.hidden && root.contains(document.activeElement);
    active = Boolean(value);
    if (root) root.hidden = !active;
    document.body.dataset.source = active ? "dummy" : "live";
    stopTick(0);
    stopTick(1);
    onToggle(active);
    if (fokusDiDalam) {
      const target = document.querySelector("#kontrol-wayang-0 button.aktif");
      if (target) target.focus();
    }
  }

  function toggle() {
    setActive(!active);
  }

  function emit(gesture, index) {
    if (!active) {
      setActive(true);
    }
    const tujuan = Number.isFinite(index) ? index : pemain;
    if (gesture === "telunjuk") {
      startTick(tujuan);
    } else {
      stopTick(tujuan);
    }
    kirim(tujuan, gesture, 0.5);
  }

  function kirim(index, gesture, wrist) {
    onGesture({ player: index, gesture: gesture, wrist: wrist });
  }

  /* telunjuk = wayang bergeser mengikuti tangan; di dummy gerakannya sinusoide. */
  function startTick(index) {
    stopTick(index);
    clock[index] = 0;
    ticks[index] = setInterval(function () {
      clock[index] += 0.1;
      const wrist = Math.max(0.08, Math.min(0.92, 0.5 + 0.3 * Math.sin(clock[index] * 1.6)));
      kirim(index, "telunjuk", wrist);
    }, 100);
  }

  function stopTick(index) {
    if (ticks[index]) {
      clearInterval(ticks[index]);
      ticks[index] = null;
    }
  }

  function onKeyDown(event) {
    const target = event.target;
    if (target && target.closest && target.closest("input, textarea, select")) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;
    if (key === "d" || key === "D") {
      event.preventDefault();
      toggle();
      return;
    }

    if (key === "p" || key === "P") {
      if (jumlah < 2) return;
      event.preventDefault();
      setPemain(pemain === 0 ? 1 : 0);
      return;
    }

    const number = Number.parseInt(key, 10);
    if (Number.isNaN(number) || number < 0 || number > 6) return;

    event.preventDefault();
    if (number === 0) {
      emit("netral");
      return;
    }
    const items = list();
    const item = items[number - 1];
    if (item) emit(item.id);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.Dummy = {
    init: init,
    rebuild: rebuild,
    toggle: toggle,
    setActive: setActive,
    setJumlah: setJumlah,
    setPemain: setPemain,
    player: function () { return pemain; },
    isActive: function () { return active; },
  };
})();
