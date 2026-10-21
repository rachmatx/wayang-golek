/* panel.js — gambar skeleton di canvas + isi panel hasil bacaan & top-3.
 *
 * Strip kaki panggung punya satu blok per pemain (id "-0" / "-1"), jadi
 * pembaruan strip selalu lewat setStrip(index, data). Kartu "Hasil Bacaan"
 * di laci cuma satu dan menampilkan pemain yang lagi jadi fokus.
 */
(function () {
  "use strict";

  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
  ];

  /* Pemain 0 emas (warna wayang), pemain 1 biru supaya dua skeleton
   * di satu frame tidak terlihat seperti satu tangan besar. */
  const WARNA = [
    { garis: "rgba(217, 181, 115, 0.85)", pendar: "rgba(217, 181, 115, 0.55)", titik: "#f5ead7" },
    { garis: "rgba(143, 201, 255, 0.85)", pendar: "rgba(143, 201, 255, 0.55)", titik: "#dff0ff" },
  ];

  const el = {};
  let threshold = 0.6;
  let canvasObserver = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    el.canvas = $("skeleton");
    el.gesture = $("hasil-gestur");
    el.confidence = $("hasil-yakin");
    el.bar = $("hasil-bar");
    el.model = $("hasil-model");
    el.fps = $("hasil-fps");
    el.top3 = $("hasil-top3");
    el.hint = $("hasil-hint");
    el.resultState = $("hasil-state");
    el.status = $("status-pill");
    el.statusLabel = el.status ? el.status.querySelector(".status-label") : null;
    el.cameraBadge = $("kamera-badge");
    el.img = $("video-feed");
    el.hasilPemain = $("hasil-pemain");
    el.stripFps = $("strip-fps");
    el.stripModel = $("strip-model");

    el.pemain = [0, 1].map(function (index) {
      return {
        gestur: $("strip-gestur-" + index),
        bar: $("strip-bar-" + index),
        yakin: $("strip-yakin-" + index),
        blok: $("kaki-pemain-" + index),
      };
    });

    if (el.canvas && "ResizeObserver" in window) {
      canvasObserver = new ResizeObserver(function () { drawLandmarks([]); });
      canvasObserver.observe(el.canvas);
    }
    window.addEventListener("resize", function () { drawLandmarks([]); });
  }

  function labelFor(gesture) {
    if (window.Wayang) return window.Wayang.labelFor(gesture);
    return gesture || "—";
  }

  /* ---------- status koneksi ---------- */
  function setConnection(state) {
    if (!el.status) return;
    el.status.dataset.state = state;
    if (el.statusLabel) {
      el.statusLabel.textContent = state === "connected"
        ? "terhubung"
        : state === "connecting" ? "menyambung…" : "terputus";
    }
  }

  /* ---------- kamera ---------- */
  function setCamera(camera) {
    if (!el.cameraBadge) return;
    if (camera === true) {
      el.cameraBadge.dataset.state = "on";
      el.cameraBadge.textContent = "kamera aktif";
    } else if (camera === false) {
      el.cameraBadge.dataset.state = "off";
      el.cameraBadge.textContent = "kamera mati";
    } else {
      el.cameraBadge.dataset.state = "wait";
      el.cameraBadge.textContent = "menunggu";
    }
  }

  /* ---------- strip per pemain ---------- */
  function setJumlah(banyak) {
    const jumlah = Math.max(1, Number(banyak) || 1);
    el.pemain.forEach(function (pemain, index) {
      if (!pemain.blok) return;
      const tampil = index < jumlah;
      pemain.blok.hidden = !tampil;
      if (!tampil) {
        pemain.gestur.textContent = "—";
        pemain.yakin.textContent = "0,00";
        pemain.bar.style.width = "0%";
        pemain.bar.classList.remove("low");
      }
    });
  }

  function setStrip(index, data) {
    const pemain = el.pemain[Number(index) || 0];
    if (!pemain) return;
    const isi = data || {};

    if ("gesture" in isi) {
      const teks = isi.gesture ? labelFor(isi.gesture) : "—";
      if (pemain.gestur && pemain.gestur.textContent !== teks) {
        pemain.gestur.textContent = teks;
      }
    }

    const score = Math.max(0, Math.min(1, Number(isi.confidence) || 0));
    const lebar = (score * 100).toFixed(1) + "%";
    if (pemain.bar) {
      pemain.bar.style.width = lebar;
      pemain.bar.classList.toggle("low", score < threshold);
    }
    if (pemain.yakin) pemain.yakin.textContent = score.toFixed(2).replace(".", ",");
  }

  function setFocus(index) {
    if (!el.hasilPemain) return;
    el.hasilPemain.textContent = "pemain " + ((Number(index) || 0) + 1);
  }

  /* ---------- hasil bacaan (pemain fokus) ---------- */
  function setGestureLabel(gesture) {
    const text = gesture ? labelFor(gesture) : "—";
    if (!el.gesture || text === el.gesture.textContent) return;
    el.gesture.textContent = text;
    el.gesture.classList.remove("pop");
    // paksa reflow supaya animasi bisa diulang
    void el.gesture.offsetWidth;
    el.gesture.classList.add("pop");
  }

  function setResultState(state) {
    if (!el.resultState) return;
    el.resultState.dataset.state = state || "unknown";
    el.resultState.textContent = state === "ok"
      ? "terbaca"
      : state === "no_hand" ? "tanpa tangan" : state === "unknown" ? "ragu" : "—";
  }

  function setConfidence(value) {
    const score = Math.max(0, Math.min(1, Number(value) || 0));
    const lebar = (score * 100).toFixed(1) + "%";
    if (el.confidence) el.confidence.textContent = Math.round(score * 100) + "%";
    if (el.bar) {
      el.bar.style.width = lebar;
      el.bar.classList.toggle("low", score < threshold);
    }
  }

  function setThreshold(value) {
    threshold = Number(value) || 0.6;
  }

  function setMeta(model, fps, modelLoaded) {
    const namaModel = model ? String(model).toUpperCase() : "—";
    if (el.model) {
      el.model.textContent = modelLoaded === false ? "belum ada model" : namaModel;
    }
    const angkaFps = fps && fps > 0 ? Math.round(fps) + " fps" : "—";
    if (el.fps) el.fps.textContent = angkaFps;
    if (el.stripModel) el.stripModel.textContent = modelLoaded === false ? "—" : namaModel;
    if (el.stripFps) el.stripFps.textContent = angkaFps;
  }

  function setTop3(items) {
    if (!el.top3) return;
    if (!Array.isArray(items) || !items.length) {
      el.top3.innerHTML = '<p class="kosong">belum ada tebakan</p>';
      return;
    }
    el.top3.innerHTML = items.slice(0, 3).map(function (item) {
      const name = Array.isArray(item) ? item[0] : item.label;
      const score = Array.isArray(item) ? item[1] : item.confidence;
      const percent = Math.round((Number(score) || 0) * 100);
      return (
        '<div class="top3-baris">' +
          '<span class="top3-nama">' + escapeHtml(labelFor(name)) + "</span>" +
          '<span class="top3-bar"><i style="width:' + percent + '%"></i></span>' +
          '<span class="top3-angka">' + percent + "%</span>" +
        "</div>"
      );
    }).join("");
  }

  function setHint(text) {
    if (el.hint) el.hint.textContent = text || "";
  }

  /* ---------- skeleton ---------- */
  /* daftar = [{ index: pemain, landmarks: [[x,y,z], ...] }, ...] */
  function drawLandmarks(daftar) {
    const canvas = el.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const tangan = Array.isArray(daftar) ? daftar : [];
    tangan.forEach(function (item) {
      if (!Array.isArray(item.landmarks) || item.landmarks.length < 21) return;
      const warna = WARNA[Number(item.index) || 0] || WARNA[0];

      const points = item.landmarks.map(function (point) {
        return [point[0] * rect.width, point[1] * rect.height];
      });

      ctx.lineWidth = 2;
      ctx.strokeStyle = warna.garis;
      ctx.shadowColor = warna.pendar;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      HAND_CONNECTIONS.forEach(function (pair) {
        const a = points[pair[0]];
        const b = points[pair[1]];
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      });
      ctx.stroke();

      ctx.shadowBlur = 0;
      points.forEach(function (point, index) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], index === 0 ? 5 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = warna.titik;
        ctx.fill();
      });
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.Panel = {
    init: init,
    setConnection: setConnection,
    setCamera: setCamera,
    setJumlah: setJumlah,
    setStrip: setStrip,
    setFocus: setFocus,
    setGestureLabel: setGestureLabel,
    setResultState: setResultState,
    setConfidence: setConfidence,
    setThreshold: setThreshold,
    setMeta: setMeta,
    setTop3: setTop3,
    setHint: setHint,
    setLandmarks: drawLandmarks,
  };
})();
