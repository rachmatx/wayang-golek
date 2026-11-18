/* Spring-driven SVG puppetry. Translation uses screen pixels on the outer slot;
 * pose joints use rig metadata in SVG units. Forearms lag behind shoulders and
 * distance drives rod-arm gait; authored phrases add preparation, accent and holds.
 * CSS owns theatrical entrances only, never the frame-driven joint transforms.
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

  /* Public gesture modes remain stable; movement phrases live in puppetry-core. */
  const POSES = {
    netral: { mode: "hold" },
    telapak_terbuka: { mode: "hold" },
    kepalan: { mode: "hold" },
    telunjuk: { mode: "follow" },
    dua_jari: { mode: "hold" },
    jempol: { mode: "auto", resetMs: 2200 },
    ok: { mode: "toggle" },
  };

  /* Dipakai bila gesture_map.json belum bisa diambil (mis. backend mati). */
  const DEFAULT_MAP = {
    version: 1,
    neutral: { id: "netral", label: "Netral", pose: "netral" },
    gestures: [
      { id: "telapak_terbuka", label: "Telapak Terbuka", pose: "telapak_terbuka", hint: "telapak tangan terbuka — wayang menyapa dengan ayunan kedua lengan" },
      { id: "kepalan", label: "Kepalan", pose: "kepalan", hint: "tangan mengepal — wayang berhenti dan diam di posisi terakhir" },
      { id: "telunjuk", label: "Telunjuk", pose: "telunjuk", hint: "satu jari menunjuk — wayang berjalan mengikuti posisi tangan dengan ayunan lengan" },
      { id: "dua_jari", label: "Dua Jari", pose: "dua_jari", hint: "dua jari terangkat — wayang memainkan dua aksen siku dan lengan" },
      { id: "jempol", label: "Jempol", pose: "jempol", hint: "jempol terangkat — lengan bersiap, wayang memberi hormat, lalu kembali tegak" },
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
    let stageWidth=1, baseCentre=0, stageTarget=null, lane=null;
    let transitionOrigin=null;
    let previousTime = 0;
    let poseTime = 0;
    let stridePhase = 0;
    let anchor = 0;
    let svgScale = 1;
    let character = 'gatotkaca';
    const travel = { x: 0, v: 0 };
    const joints = Object.fromEntries(LAYERS.concat("group", "lift").map(id => [id, { x: 0, v: 0 }]));
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
        const paused = document.hidden || (window.Teater && Teater.isReading()) || (window.Lakon && Lakon.isPaused());
        if (!paused) {
          poseTime += dt;
          const desired = stageTarget!==null ? stageTarget*stageWidth-baseCentre : currentPose === "telunjuk" ? Motion.follow(wrist, bounds, window.Kendali ? Kendali.settings(nomor) : null) : anchor;
          const target=Motion.clamp(desired,bounds.min,bounds.max);
          const oldX = travel.x;
          if (reduced.matches) { travel.x = target; travel.v = 0; }
          else Motion.spring(travel, target, dt, stageTarget!==null && currentPose==='telunjuk' ? 5 : 15);
          // Clamp the rendered position too: a rapid reversal must never overshoot the stage.
          travel.x = Motion.clamp(travel.x, bounds.min, bounds.max);
          stageX = travel.x;
          container.style.transform = "translateX(" + stageX.toFixed(2) + "px)";
          const profile = WayangPuppetry.profiles[character] || WayangPuppetry.profiles.gatotkaca;
          stridePhase += Math.abs(travel.x - oldX) / Math.max(18, svgScale * profile.stride) * Math.PI * 2;
          let phrase = WayangPuppetry.sample(currentPose, poseTime, {
            character, speed: travel.v / Math.max(.3, svgScale), stride: stridePhase,
            facing, reduced: reduced.matches,
          });
          if (transitionOrigin && !reduced.matches) phrase=WayangPuppetry.blendFrom(phrase,transitionOrigin,poseTime,.24);
          LAYERS.forEach(function (id, i) {
            const element = nodes[id];
            if (!element) return;
            const targetAngle = i > 0 ? phrase.angles[i - 1] : 0;
            const joint = joints[id];
            if (reduced.matches) { joint.x = targetAngle; joint.v = 0; }
            else Motion.spring(joint, targetAngle, dt, id.includes("bawah") ? 19 : 25);
            element.style.transform = "rotate(" + joint.x.toFixed(3) + "deg)";
          });
          const bodyTarget = phrase.body;
          if (reduced.matches) { joints.group.x = bodyTarget; joints.group.v = 0; }
          else Motion.spring(joints.group, bodyTarget, dt, 24);
          if (reduced.matches) { joints.lift.x = 0; joints.lift.v = 0; }
          else Motion.spring(joints.lift, phrase.lift, dt, 25);
          if (nodes.wayang) nodes.wayang.style.transform = "translateY(" + (-joints.lift.x).toFixed(2) + "px) rotate(" + joints.group.x.toFixed(3) + "deg)";
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }

    /* ---------- pemuatan SVG ---------- */
    async function load(svgUrl, options) {
      const start = options || {};
      character = start.character || 'gatotkaca';
      const response = await fetch(svgUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("SVG wayang tidak bisa dimuat (HTTP " + response.status + ")");

      stopLoop();
      stageTarget=lane=transitionOrigin=null;
      stageX = 0;
      anchor = poseTime = stridePhase = 0;
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
        svgScale = scale || 1;
        const envelope = Math.min(width * scale * 0.54, sr.width * 0.42);
        const centre = cr.left + cr.width / 2 - stageX;
        stageWidth=sr.width; baseCentre=centre-sr.left;
        bounds = Motion.laneBounds(Motion.bounds(sr.width, baseCentre, envelope, 20),sr.width,baseCentre,envelope,lane,16);
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
      // A planted puppet stays where the dalang left it instead of gliding home.
      if (currentPose === 'telunjuk' && name !== 'telunjuk') {
        anchor = travel.x;
        travel.v = 0;
      }
      transitionOrigin={angles:LAYERS.slice(1).map(id=>joints[id].x),body:joints.group.x,lift:joints.lift.x};
      currentPose = name;
      poseTime = 0;
      if (name !== "telunjuk" && window.Kendali) Kendali.clear(nomor);

      // Targets are blended every frame; interrupted poses keep their current velocity.
      return pose;
    }

    /* ---------- arah hadap (gestur ok) ---------- */
    function setFacing(value, animate) {
      facing = value < 0 ? -1 : 1;
      if (nodes.arah) {
        nodes.arah.style.transitionDuration = animate === false || reduced.matches ? "0ms" : "240ms";
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
      if (currentPose === "telunjuk" && window.Kendali) Kendali.record(nomor, wrist, document.body.dataset.source === "dummy" ? "practice" : "live");
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
      setLane: function(side) {lane=side;measureTravel();},
      setStageTarget: function(value) {stageTarget=Number.isFinite(value)?Motion.clamp(value,0,1):null;anchor=travel.x;},
      position: function() {measureTravel();return (baseCentre+travel.x)/stageWidth;},
      restorePosition: function(value) {measureTravel();stageTarget=null;travel.x=Number.isFinite(value)?Motion.clamp(value*stageWidth-baseCentre,bounds.min,bounds.max):0;travel.v=0;anchor=stageX=travel.x;container.style.transform='translateX('+stageX+'px)';},
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
