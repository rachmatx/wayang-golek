/* Spring-driven SVG puppetry. Translation uses screen pixels on the outer slot;
 * pose joints use rig metadata in SVG units. Forearms lag behind shoulders and
 * velocity drives a small body lean/arm sway. CSS owns theatrical entrance/bow.
 * Every SVG ID/reference is prefixed so two instances remain independent.
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

  /* Detached Jatim limbs allow larger shoulder/elbow gestures than the legacy rig. */
  const POSES = {
    netral: {
      angles: {},
      group: 0,
      duration: 400,
      mode: "hold",
    },
    telapak_terbuka: {
      angles: {
        "lengan-atas-kiri": 34,
        "lengan-bawah-kiri": -24,
        "lengan-atas-kanan": -30,
        "lengan-bawah-kanan": 20,
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
      /* Cepala gesture: raise the shoulder, then fold the forearm. */
      angles: {
        "lengan-atas-kiri": 24,
        "lengan-bawah-kiri": -38,
        "lengan-atas-kanan": -7,
      },
      group: 0,
      duration: 600,
      mode: "hold",
    },
    jempol: {
      /* Tidak ada layer kepala: seluruh wayang membungkuk dari kaki. */
      angles: {},
      group: 12,
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

  const Motion = window.WayangMotion;

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
    let wrist = 0.5;
    let bounds = { min: 0, max: 0 };
    let previousTime = 0;
    let phase = nomor * 1.7;
    const travel = { x: 0, v: 0 };
    const joints = Object.fromEntries(LAYERS.concat("group").map(id => [id, { x: 0, v: 0 }]));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let measureTravel = function () {};
    const resize = new ResizeObserver(function () { measureTravel(); });
    resize.observe(container);
    let rafId = null;
    let facingHandler = null;
    let destroyed = false;

    /* Semua ID di dalam SVG ini diganti jadi prefixed, ID aslinya disimpan
     * sebagai class supaya CSS dan querySelector tetap bisa pakai nama rig. */
    function prefixIds(svg) {
      const ids = new Map();
      const semua = svg.querySelectorAll("[id]");
      semua.forEach(function (element) {
        const asli = element.id;
        if (asli.indexOf(prefix) === 0) return;
        element.classList.add(asli);
        ids.set(asli, prefix + asli);
        element.id = prefix + asli;
      });
      svg.querySelectorAll("*").forEach(function (element) {
        Array.from(element.attributes).forEach(function (attribute) {
          let value = attribute.value;
          value = value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, function (match, id) {
            return ids.has(id) ? "url(#" + ids.get(id) + ")" : match;
          });
          if ((attribute.localName === "href") && value.charAt(0) === "#" && ids.has(value.slice(1))) {
            value = "#" + ids.get(value.slice(1));
          }
          if (attribute.name === "aria-labelledby" || attribute.name === "aria-describedby") {
            value = value.split(/\s+/).map(function (id) { return ids.get(id) || id; }).join(" ");
          }
          if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
        });
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
      previousTime = 0;
      const step = function (now) {
        if (destroyed) { rafId = null; return; }
        const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
        previousTime = now;
        const paused = document.hidden || (window.Teater && Teater.isReading());
        if (!paused) {
          phase += dt;
          const pose = POSES[currentPose] || POSES.netral;
          const target = currentPose === "telunjuk" ? Motion.follow(wrist, bounds) : 0;
          if (reduced.matches) { travel.x = target; travel.v = 0; }
          else Motion.spring(travel, target, dt, 15);
          // Clamp the rendered position too: a rapid reversal must never overshoot the stage.
          travel.x = Motion.clamp(travel.x, bounds.min, bounds.max);
          stageX = travel.x;
          container.style.transform = "translateX(" + stageX.toFixed(2) + "px)";
          const speed = reduced.matches ? 0 : Motion.clamp(travel.v / 110, -4, 4);
          const breathing = reduced.matches ? 0 : Math.sin(phase * 1.65) * 0.55;
          const moving = Math.min(Math.abs(travel.v) / 180, 1);
          const sway = Math.sin(phase * 7) * moving;
          LAYERS.forEach(function (id, i) {
            const element = nodes[id];
            if (!element) return;
            const isArm = i > 0;
            const side = id.endsWith("kiri") ? 1 : -1;
            const secondary = isArm ? side * (speed * 1.7 + sway * 3 + breathing * 1.5) : 0;
            const targetAngle = (pose.angles[id] || 0) + secondary;
            const joint = joints[id];
            if (reduced.matches) { joint.x = targetAngle; joint.v = 0; }
            else Motion.spring(joint, targetAngle, dt, id.includes("bawah") ? 10 : 13);
            element.style.transform = "rotate(" + joint.x.toFixed(3) + "deg)";
          });
          const bodyTarget = (pose.group || 0) + speed * facing * 0.65 + breathing;
          if (reduced.matches) { joints.group.x = bodyTarget; joints.group.v = 0; }
          else Motion.spring(joints.group, bodyTarget, dt, 11);
          if (nodes.wayang) nodes.wayang.style.transform = "translateY(" + (-Math.abs(sway) * 1.7).toFixed(2) + "px) rotate(" + joints.group.x.toFixed(3) + "deg)";
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
      wrist = 0.5;
      travel.x = travel.v = 0;
      container.style.transform = "translateX(0px)";
      Object.values(joints).forEach(j => { j.x = j.v = 0; });
      const previousSvg = container.querySelector("svg");
      if (previousSvg) resize.unobserve(previousSvg);
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
      const footX = Number(svg.dataset.footX) || width * 0.63;
      const footY = Number(svg.dataset.footY) || height * 0.88;

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
      shadow.setAttribute("cx", String(footX));
      shadow.setAttribute("cy", String(footY));
      shadow.setAttribute("rx", String(width * 0.149));
      shadow.setAttribute("ry", String(height * 0.0196));
      shadow.setAttribute("fill", "rgba(0, 0, 0, 0.5)");
      posisi.insertBefore(shadow, arah);

      /* Pivot cermin di tengah kanvas; pivot bungkuk/idle di kaki wayang.
       * Angka kaki (0.63 / 0.88 dari viewBox) dituning sekali untuk rig P2. */
      gayaPivot(arah, width / 2, height / 2);
      gayaPivot(hidup, footX, footY);
      gayaPivot(wayang, footX, footY);

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

      // Keep a safety envelope for raised arms/tilt; allow crossing the centre in duet.
      // Range is measured in screen pixels, independent of SVG letterboxing and fullscreen.
      measureTravel = function () {
        const stage = container.closest(".panggung");
        if (!stage || !container.offsetWidth) return;
        const sr = stage.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        const scale = Math.min(svg.clientWidth / width, svg.clientHeight / height);
        const envelope = Math.min(width * scale * 0.54, sr.width * 0.42);
        const centre = cr.left + cr.width / 2 - stageX;
        bounds = Motion.bounds(sr.width, centre - sr.left, envelope, 20);
      };
      resize.observe(svg);
      measureTravel();
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

      // Targets are blended every frame; interrupted poses keep their current velocity.
      return pose;
    }

    /* ---------- arah hadap (gestur ok) ---------- */
    function setFacing(value, animate) {
      facing = value < 0 ? -1 : 1;
      if (nodes.arah) {
        nodes.arah.style.transitionDuration = animate === false || reduced.matches ? "0ms" : "400ms";
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
      wrist = Motion.clamp(value, 0, 1);
    }

    function onFacingChange(handler) {
      facingHandler = handler;
      if (handler) handler(facing, nomor);
    }

    function destroy() {
      destroyed = true;
      stopLoop();
      resize.disconnect();
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
