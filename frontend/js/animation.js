/* animation.js — mesin pose wayang (Rancangan Bab 3.3 & 3.4).
 *
 * Wayang tidak digambar ulang tiap frame. Setiap gestur punya pose: daftar
 * sudut putar untuk tiap layer SVG, lalu browser yang menggerakkannya lewat
 * transisi CSS. Nama pose diambil dari shared/gesture_map.json.
 *
 * Rig dari P2 (`handoff_p2/wayang_kiri.svg`):
 *   .grup-posisi  (dibuat di sini)  -> geser panggung mengikuti wrist_x
 *     .grup-arah  (dibuat di sini)  -> cermin kiri/kanan (gestur ok)
 *       .grup-hidup                 -> idle / membungkuk
 *         .grup-wayang              -> pose (gestur jempol)
 *           .badan
 *           .lengan-atas-*  -> .lengan-bawah-*  (nested, pivot dari data-pivot-x/y)
 *
 * Dua wayang sekaligus: satu SVG dipasang dua kali, dan ID tidak boleh dobel
 * di satu dokumen. Jadi tiap instans diberi prefix ("p0-", "p1-") dan ID
 * aslinya disimpan sebagai class. Semua CSS rig memakai class, bukan ID.
 *
 * Tidak ada .kepala dan .tongkat di rig P2 (lihat handoff_p2/DEVIATION.md):
 *   - jempol   -> putar .grup-wayang 7° dengan pivot di kaki
 *   - dua_jari -> putar .lengan-bawah-kiri (batang/cepala menempel di tangan)
 */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  const LAYERS = [
    "badan",
    "lengan-atas-kiri",
    "lengan-bawah-kiri",
    "lengan-atas-kanan",
    "lengan-bawah-kanan",
  ];

  /* Angka mengikuti rentang aman rigging P2 (DEVIATION.md bagian 2):
   * bahu ±25°, siku kiri −40…+15°, siku kanan −15…+40°.
   * Arah: bahu kiri + = angkat, bahu kanan − = angkat,
   *       siku kiri − = lipat/angkat, siku kanan + = lipat/angkat. */
  const POSES = {
    netral: {
      angles: {},
      group: 0,
      duration: 400,
      mode: "hold",
    },
    telapak_terbuka: {
      angles: {
        "lengan-atas-kiri": 20,
        "lengan-atas-kanan": -20,
      },
      group: 0,
      duration: 600,
      mode: "hold",
    },
    kepalan: {
      angles: {},
      group: 0,
      duration: 500,
      mode: "hold",
    },
    telunjuk: {
      /* Aksi utama: panggung bergeser mengikuti wrist_x (lihat setWrist). */
      angles: {},
      group: 0,
      duration: 300,
      mode: "follow",
    },
    dua_jari: {
      /* Angkat sedikit lengan bawah kiri. Sudut sengaja kecil: art raster
       * tidak punya sendi siku gambar tangan, jadi tekukan besar bikin
       * potongan lengan kelihatan. */
      angles: {
        "lengan-atas-kiri": 8,
        "lengan-bawah-kiri": -14,
      },
      group: 0,
      duration: 600,
      mode: "hold",
    },
    jempol: {
      /* Tidak ada layer kepala: seluruh wayang membungkuk dari kaki. */
      angles: {},
      group: 7,
      duration: 700,
      mode: "auto",
      resetMs: 1000,
    },
    ok: {
      angles: {},
      group: 0,
      duration: 400,
      mode: "toggle",
    },
  };

  /* Dipakai bila gesture_map.json belum bisa diambil (mis. backend mati). */
  const DEFAULT_MAP = {
    version: 1,
    neutral: { id: "netral", label: "Netral", pose: "netral" },
    gestures: [
      { id: "telapak_terbuka", label: "Telapak Terbuka", pose: "telapak_terbuka", hint: "kedua tangan terbuka — wayang mengangkat kedua lengan" },
      { id: "kepalan", label: "Kepalan", pose: "kepalan", hint: "tangan mengepal — perintah eksplisit kembali diam" },
      { id: "telunjuk", label: "Telunjuk", pose: "telunjuk", hint: "satu jari menunjuk — wayang bergeser mengikuti posisi tangan" },
      { id: "dua_jari", label: "Dua Jari", pose: "dua_jari", hint: "dua jari terangkat — lengan bawah dan cepala terangkat" },
      { id: "jempol", label: "Jempol", pose: "jempol", hint: "jempol terangkat — wayang membungkuk, lalu kembali sendiri" },
      { id: "ok", label: "OK", pose: "ok", hint: "jari membentuk lingkaran — wayang berbalik arah" },
    ],
  };

  const MAX_SHIFT = 64;   // geseran panggung maksimum (satuan viewBox)
  const DEADZONE = 0.03;  // zona mati di tengah
  const LERP = 0.2;       // perataan posisi (Bab 3.3)

  let map = DEFAULT_MAP;

  /* ---------- peta gestur ---------- */
  function gestures() {
    return map.gestures || DEFAULT_MAP.gestures;
  }

  function labelFor(gesture) {
    if (!gesture) return "—";
    if (gesture === "netral") return "Netral";
    const found = gestures().find(function (item) { return item.id === gesture; });
    if (found) return found.label;
    return String(gesture).replace(/_/g, " ");
  }

  function poseFor(gesture) {
    const found = gestures().find(function (item) { return item.id === gesture; });
    const name = (found && found.pose) || gesture || "netral";
    return POSES[name] || POSES.netral;
  }

  async function loadMap(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (data && Array.isArray(data.gestures) && data.gestures.length) {
        map = data;
        document.dispatchEvent(new CustomEvent("gesturemap", { detail: map }));
      }
    } catch (error) {
      console.warn("[wayang] gesture_map.json gagal dimuat, pakai peta bawaan.", error);
    }
    return map;
  }

  /* ---------- satu pemain = satu wayang ---------- */
  function createPlayer(container, index) {
    const nomor = Number.isFinite(index) ? index : 0;
    const prefix = "p" + nomor + "-";

    let nodes = { posisi: null, arah: null, hidup: null, wayang: null };
    let currentPose = null;
    let facing = 1;
    let stageX = 0;
    let targetX = 0;
    let rafId = null;
    let facingHandler = null;
    let destroyed = false;

    /* Semua ID di dalam SVG ini diganti jadi prefixed, ID aslinya disimpan
     * sebagai class supaya CSS dan querySelector tetap bisa pakai nama rig. */
    function prefixIds(svg) {
      const semua = svg.querySelectorAll("[id]");
      semua.forEach(function (element) {
        const asli = element.id;
        if (asli.indexOf(prefix) === 0) return;
        element.classList.add(asli);
        element.id = prefix + asli;
      });
    }

    function buatGrup(nama) {
      const element = document.createElementNS(SVG_NS, "g");
      element.id = prefix + nama;
      element.classList.add(nama);
      return element;
    }

    function gayaPivot(element, x, y) {
      element.style.transformBox = "view-box";
      element.style.transformOrigin = x + "px " + y + "px";
    }

    function stopLoop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function startLoop() {
      stopLoop();
      const step = function () {
        if (destroyed) { rafId = null; return; }
        stageX += (targetX - stageX) * LERP;
        if (Math.abs(targetX - stageX) < 0.05) stageX = targetX;
        if (nodes.posisi) {
          nodes.posisi.setAttribute("transform", "translate(" + stageX.toFixed(2) + ",0)");
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }

    /* ---------- pemuatan SVG ---------- */
    async function load(svgUrl, options) {
      const start = options || {};
      const response = await fetch(svgUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("SVG wayang tidak bisa dimuat (HTTP " + response.status + ")");

      stopLoop();
      stageX = 0;
      targetX = 0;
      container.innerHTML = await response.text();

      const svg = container.querySelector("svg");
      if (!svg) throw new Error("Berkas wayang.svg tidak berisi elemen <svg>");
      svg.classList.add("wayang-svg");
      prefixIds(svg);

      const wayang = container.querySelector(".grup-wayang");
      if (!wayang) throw new Error("wayang.svg tidak punya grup-wayang");

      const viewBox = svg.viewBox && svg.viewBox.baseVal;
      const width = viewBox && viewBox.width ? viewBox.width : 444;
      const height = viewBox && viewBox.height ? viewBox.height : 562;

      /* Bungkus grup asli P2:
       * grup-posisi (geser) > grup-arah (cermin) > grup-hidup (idle/bungkuk)
       * > grup-wayang (pose). */
      const hidup = buatGrup("grup-hidup");
      wayang.parentNode.insertBefore(hidup, wayang);
      hidup.appendChild(wayang);

      const arah = buatGrup("grup-arah");
      hidup.parentNode.insertBefore(arah, hidup);
      arah.appendChild(hidup);

      const posisi = buatGrup("grup-posisi");
      arah.parentNode.insertBefore(posisi, arah);
      posisi.appendChild(arah);

      /* Bayangan di dalam grup-posisi supaya ikut bergeser bersama wayang. */
      const shadow = document.createElementNS(SVG_NS, "ellipse");
      shadow.id = prefix + "bayangan-wayang";
      shadow.classList.add("bayangan-wayang");
      shadow.setAttribute("cx", String(width * 0.63));
      shadow.setAttribute("cy", String(height * 0.88));
      shadow.setAttribute("rx", String(width * 0.149));
      shadow.setAttribute("ry", String(height * 0.0196));
      shadow.setAttribute("fill", "rgba(0, 0, 0, 0.5)");
      posisi.insertBefore(shadow, arah);

      /* Pivot cermin di tengah kanvas; pivot bungkuk/idle di kaki wayang.
       * Angka kaki (0.63 / 0.88 dari viewBox) dituning sekali untuk rig P2. */
      gayaPivot(arah, width / 2, height / 2);
      gayaPivot(hidup, width * 0.63, height * 0.88);
      gayaPivot(wayang, width * 0.63, height * 0.88);

      nodes = { posisi: posisi, arah: arah, hidup: hidup, wayang: wayang };
      LAYERS.forEach(function (id) {
        nodes[id] = container.querySelector("." + id);
      });

      /* Pivot sendi dibaca dari data-pivot-x / data-pivot-y milik P2 —
       * angkanya sama dengan handoff_p2/pivots.json. */
      LAYERS.forEach(function (id) {
        const element = nodes[id];
        if (!element) return;
        const px = element.dataset ? element.dataset.pivotX : null;
        const py = element.dataset ? element.dataset.pivotY : null;
        if (px !== undefined && py !== undefined) {
          gayaPivot(element, Number(px), Number(py));
        }
      });

      const missing = LAYERS.filter(function (id) { return !nodes[id]; });
      if (missing.length) {
        console.warn("[wayang] p" + nomor + " layer tidak ditemukan:", missing.join(", "));
      }

      currentPose = null;
      startLoop();
      applyPose(start.pose || "netral", true);
      setFacing(start.facing === -1 ? -1 : 1, false);
      return svg;
    }

    /* ---------- pose ---------- */
    function applyPose(name, force) {
      const pose = POSES[name] || POSES.netral;
      if (!force && name === currentPose) return pose;
      currentPose = name;

      LAYERS.forEach(function (id) {
        const element = nodes[id];
        if (!element) return;
        const angle = Object.prototype.hasOwnProperty.call(pose.angles, id) ? pose.angles[id] : 0;
        element.style.transitionDuration = pose.duration + "ms";
        element.style.transform = "rotate(" + angle + "deg)";
      });

      if (nodes.wayang) {
        nodes.wayang.style.transitionDuration = pose.duration + "ms";
        nodes.wayang.style.transform = "rotate(" + (pose.group || 0) + "deg)";
      }
      return pose;
    }

    /* ---------- arah hadap (gestur ok) ---------- */
    function setFacing(value, animate) {
      facing = value < 0 ? -1 : 1;
      if (nodes.arah) {
        nodes.arah.style.transitionDuration = animate === false ? "0ms" : "400ms";
        nodes.arah.style.transform = "scaleX(" + facing + ")";
      }
      if (facingHandler) facingHandler(facing, nomor);
    }

    function toggleFacing() {
      setFacing(-facing, true);
      return facing;
    }

    /* ---------- geser panggung mengikuti wrist_x (gestur telunjuk) ---------- */
    function setWrist(wristX) {
      const value = Number(wristX);
      if (!Number.isFinite(value)) return;
      const delta = value - 0.5;
      const clamped = Math.max(-1, Math.min(1, delta * 2));
      targetX = Math.abs(delta) < DEADZONE ? 0 : clamped * MAX_SHIFT;
    }

    function onFacingChange(handler) {
      facingHandler = handler;
      if (handler) handler(facing, nomor);
    }

    function destroy() {
      destroyed = true;
      stopLoop();
      facingHandler = null;
      container.innerHTML = "";
      nodes = { posisi: null, arah: null, hidup: null, wayang: null };
      currentPose = null;
    }

    return {
      index: nomor,
      container: container,
      nodes: nodes,
      load: load,
      applyPose: applyPose,
      currentPose: function () { return currentPose; },
      setWrist: setWrist,
      setFacing: setFacing,
      toggleFacing: toggleFacing,
      facing: function () { return facing; },
      onFacingChange: onFacingChange,
      destroy: destroy,
    };
  }

  window.Wayang = {
    createPlayer: createPlayer,
    loadMap: loadMap,
    poseFor: poseFor,
    labelFor: labelFor,
    gestures: gestures,
    map: function () { return map; },
  };
})();
