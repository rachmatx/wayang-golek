/* theater-core.js — state machine panggung hidup, tanpa DOM.
 *
 * Semua waktu absolut datang dari tick(now) / argumen now supaya bisa diuji
 * di Node tanpa timer. Setiap mutasi mengembalikan { state, effects };
 * theater.js yang mengeksekusi efeknya.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.TeaterCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TIMING = {
    welcome: 800,
    idleEnter: 2000,
    idleFirst: 8000,
    idleMin: 10000,
    idleMax: 14000,
    ambientMin: 20000,
    ambientMax: 40000,
    half: 45000,
    sleep: 90000,
    bubbleMin: 3500,
    bubbleMax: 4500,
    cooldown: 2500,
    wake: 2500,
    dim: 1500,
    bright: 1200,
  };

  const GESTURE_LIGHT = {
    kepalan: "dim",
    telapak_terbuka: "bright",
  };

  function create(options) {
    const opts = options || {};
    const dialog = opts.dialog || { karakter: {} };
    const random = typeof opts.random === "function" ? opts.random : Math.random;

    const s = {
      act: "pembuka",
      character: "klasik",
      connected: true,
      sound: true,
      busy: false,
      hand: false,
      justWoke: false,
      hadDisconnect: false,
      lastGesture: null,
      lastCueAt: -Infinity,
      now: 0,
      stateSince: 0,
      noHandAt: null,
      jedaAt: null,
      halfDone: false,
      welcomeAt: null,
      idleAt: null,
      ambientAt: null,
      wakeAt: null,
      lightRevertAt: null,
      lastVariant: {},
    };

    function clock(now) {
      const value = Number(now);
      return Number.isFinite(value) ? value : s.now;
    }

    function randBetween(min, max) {
      return min + Math.floor(random() * (max - min + 1));
    }

    function result(effects) {
      return { state: s.act, effects: effects };
    }

    function charDialog(charKey) {
      const all = dialog.karakter || {};
      return all[charKey] || all[s.character] || all.klasik || { gestur: {}, suasana: {} };
    }

    function pick(kind, key, lines, charKey) {
      if (!Array.isArray(lines) || !lines.length) return null;
      let index = Math.floor(random() * lines.length);
      if (index >= lines.length) index = 0;
      const memoKey = (charKey || s.character) + ":" + kind + ":" + key;
      const last = s.lastVariant[memoKey];
      if (lines.length > 1 && index === last) index = (index + 1) % lines.length;
      s.lastVariant[memoKey] = index;
      return lines[index];
    }

    function bubbleFor(kind, key, delay, charKey) {
      const source = charDialog(charKey);
      const lines = kind === "gestur"
        ? (source.gestur || {})[key]
        : (source.suasana || {})[key];
      const text = pick(kind, key, lines, charKey);
      if (!text) return null;
      const effect = {
        type: "bubble",
        text: text,
        ms: randBetween(TIMING.bubbleMin, TIMING.bubbleMax),
      };
      if (charKey) effect.char = charKey;
      if (delay > 0) effect.delay = delay;
      return effect;
    }

    function init(config) {
      const setup = config || {};
      s.now = clock(setup.now || 0);
      s.act = "pembuka";
      s.character = setup.character || s.character || "klasik";
      s.stateSince = s.now;
      s.welcomeAt = s.now + TIMING.welcome;
      s.noHandAt = null;
      s.jedaAt = null;
      s.halfDone = false;
      s.idleAt = null;
      s.ambientAt = null;
      s.wakeAt = null;
      s.lastGesture = null;
      s.lastCueAt = -Infinity;
      s.lightRevertAt = null;
      s.justWoke = false;
      s.busy = false;
      return result([
        { type: "curtain", open: false },
        { type: "light", level: "low" },
        { type: "idle", on: false },
        { type: "character", key: s.character },
      ]);
    }

    function scheduleAmbient(now) {
      s.ambientAt = now + randBetween(TIMING.ambientMin, TIMING.ambientMax);
    }

    function open(source, now) {
      const at = clock(now);
      if (s.busy || s.act !== "pembuka" || s.wakeAt !== null) {
        return result([]);
      }

      s.act = "live";
      s.now = at;
      s.stateSince = at;
      s.welcomeAt = null;
      s.wakeAt = null;
      s.jedaAt = null;
      s.noHandAt = null;
      s.halfDone = false;
      s.idleAt = null;
      s.justWoke = false;
      s.hand = true;
      scheduleAmbient(at);

      const effects = [
        { type: "idle", on: false },
        { type: "curtain", open: true },
        { type: "light", level: "full" },
        { type: "sound", cue: "buka" },
      ];
      if (source === "button") effects.push({ type: "bow" });

      const bubble = bubbleFor("suasana", "sambutan2", 0);
      if (bubble) effects.push(bubble);
      return result(effects);
    }

    function gesture(payload, now) {
      const at = clock(now);
      const name = payload && payload.gesture;
      if (!name || s.busy) return result([]);

      if (name === "netral") {
        s.lastGesture = null;
        return result([]);
      }

      if (s.act === "pembuka") {
        s.lastGesture = name;
        if (s.wakeAt !== null) return result([]);
        return open("gesture", at);
      }

      if (s.act === "tidur") {
        s.lastGesture = name;
        return hand(at);
      }

      let effects = [];
      if (s.act === "jeda") {
        const wake = hand(at);
        effects = wake.effects.slice();
      }

      if (!s.connected) {
        s.lastGesture = name;
        return result(effects);
      }

      if (name === s.lastGesture) return result(effects);
      s.lastGesture = name;

      const delay = s.justWoke ? 900 : 0;
      s.justWoke = false;
      /* Dialog gestur memakai karakter wayang yang sedang beraksi (payload
       * dari app.js), bukan selalu karakter panggung: wayang kanan yang
       * bergerak harus bicara dengan teks dan suaranya sendiri. Dialog
       * suasana tetap milik karakter panggung (pemain 1). */
      const charKey = payload && typeof payload.character === "string" ? payload.character : null;
      const bubble = bubbleFor("gestur", name, delay, charKey);
      if (bubble && payload && typeof payload.player === "number") bubble.player = payload.player;
      if (bubble) effects.push(bubble);

      const cooled = at - s.lastCueAt < TIMING.cooldown;
      s.lastCueAt = at;
      if (cooled) return result(effects);

      effects.push({ type: "sound", cue: name });

      const level = GESTURE_LIGHT[name] || "full";
      effects.push({ type: "light", level: level });
      if (level === "dim" || level === "bright") {
        s.lightRevertAt = at + (level === "dim" ? TIMING.dim : TIMING.bright);
      } else {
        s.lightRevertAt = null;
      }

      return result(effects);
    }

    function noHand(now) {
      const at = clock(now);
      s.hand = false;
      s.justWoke = false;
      if (s.act === "live" && s.jedaAt === null) {
        s.noHandAt = at;
        s.jedaAt = at + TIMING.idleEnter;
      }
      return result([]);
    }

    function hand(now) {
      const at = clock(now);
      s.hand = true;
      const effects = [];

      if (s.act === "jeda") {
        s.act = "live";
        s.now = at;
        s.stateSince = at;
        s.jedaAt = null;
        s.idleAt = null;
        s.noHandAt = null;
        s.halfDone = false;
        s.justWoke = true;
        effects.push({ type: "idle", on: false });
        effects.push({ type: "light", level: "full" });
        const bubble = bubbleFor("suasana", "bangun", 0);
        if (bubble) effects.push(bubble);
        if (s.ambientAt === null) scheduleAmbient(at);
      } else if (s.act === "tidur") {
        s.act = "pembuka";
        s.now = at;
        s.stateSince = at;
        s.wakeAt = at + TIMING.wake;
        s.idleAt = null;
        s.noHandAt = null;
        s.jedaAt = null;
        s.halfDone = false;
        s.welcomeAt = null;
        effects.push({ type: "idle", on: false });
        effects.push({ type: "curtain", open: true });
        effects.push({ type: "light", level: "full" });
        const bubble = bubbleFor("suasana", "bangun", 0);
        if (bubble) effects.push(bubble);
      } else if (s.act === "live") {
        s.jedaAt = null;
      }

      return result(effects);
    }

    function tick(now) {
      const at = clock(now);
      s.now = at;
      const effects = [];

      if (s.act === "pembuka") {
        if (s.welcomeAt !== null && at >= s.welcomeAt) {
          const bubble = bubbleFor("suasana", "sambutan", 0);
          if (bubble) effects.push(bubble);
          s.welcomeAt = null;
        }
        if (s.wakeAt !== null && at >= s.wakeAt) {
          s.act = "live";
          s.stateSince = at;
          s.wakeAt = null;
          s.welcomeAt = null;
          s.hand = true;
          effects.push({ type: "idle", on: false });
          effects.push({ type: "curtain", open: true });
          effects.push({ type: "light", level: "full" });
          scheduleAmbient(at);
        }
        return result(effects);
      }

      if (s.act === "live" && s.jedaAt !== null && at >= s.jedaAt) {
        s.act = "jeda";
        s.stateSince = s.jedaAt;
        s.idleAt = s.stateSince + TIMING.idleFirst;
        effects.push({ type: "idle", on: true });
        effects.push({ type: "light", level: "idle" });
        if (s.ambientAt === null) scheduleAmbient(at);
      }

      if (s.act === "jeda") {
        if (!s.halfDone && s.noHandAt !== null && at >= s.noHandAt + TIMING.half) {
          s.halfDone = true;
          effects.push({ type: "curtain", open: true, half: true });
          const bubble = bubbleFor("suasana", "half", 0);
          if (bubble) effects.push(bubble);
        }

        if (s.noHandAt !== null && at >= s.noHandAt + TIMING.sleep) {
          s.act = "tidur";
          s.idleAt = null;
          s.jedaAt = null;
          s.halfDone = true;
          s.lightRevertAt = null;
          effects.push({ type: "idle", on: false });
          effects.push({ type: "curtain", open: false });
          effects.push({ type: "light", level: "off" });
          effects.push({ type: "sound", cue: "tidur" });
          const bubble = bubbleFor("suasana", "tidur", 0);
          if (bubble) effects.push(bubble);
          return result(effects);
        }

        if (s.idleAt !== null && at >= s.idleAt) {
          const bubble = bubbleFor("suasana", "idle", 0);
          if (bubble) effects.push(bubble);
          s.idleAt = at + randBetween(TIMING.idleMin, TIMING.idleMax);
        }
      }

      if ((s.act === "live" || s.act === "jeda") && s.connected) {
        if (s.ambientAt !== null && at >= s.ambientAt) {
          effects.push({ type: "ambient" });
          scheduleAmbient(at);
        }
      }

      if (s.lightRevertAt !== null && at >= s.lightRevertAt) {
        s.lightRevertAt = null;
        effects.push({ type: "light", level: s.act === "jeda" ? "idle" : "full" });
      }

      return result(effects);
    }

    function exitCharacter(now) {
      const at = clock(now);
      if (s.busy) return result([]);
      s.busy = true;
      s.now = at;
      s.justWoke = false;
      const effects = [{ type: "exit-character" }];
      const bubble = bubbleFor("suasana", "keluar", 0);
      if (bubble) effects.push(bubble);
      return result(effects);
    }

    function enterCharacter(now) {
      const at = clock(now);
      s.busy = false;
      s.now = at;
      const effects = [
        { type: "character", key: s.character },
        { type: "enter-character", character: s.character },
      ];
      if (s.act === "live" || s.act === "jeda") {
        const bubble = bubbleFor("suasana", "masuk", 900);
        if (bubble) effects.push(bubble);
      }
      return result(effects);
    }

    function setCharacter(key, now) {
      s.character = key || "klasik";
      return enterCharacter(now);
    }

    function connection(state, now) {
      const at = clock(now);
      const connected = state === "connected";
      const effects = [];

      if (connected) {
        s.connected = true;
        effects.push({ type: "ribbon", visible: false });
        if (s.hadDisconnect) {
          s.hadDisconnect = false;
          if (s.act === "live" || s.act === "jeda") {
            const bubble = bubbleFor("suasana", "sambung", 0);
            if (bubble) effects.push(bubble);
          }
          if (s.ambientAt === null) scheduleAmbient(at);
        }
      } else {
        s.connected = false;
        s.hadDisconnect = true;
        effects.push({ type: "ribbon", visible: true });
      }

      return result(effects);
    }

    function setSound(on) {
      s.sound = Boolean(on);
      return result([]);
    }

    function shift(ms) {
      const delta = Number(ms);
      if (!Number.isFinite(delta) || delta === 0) return result([]);
      ["now", "stateSince", "welcomeAt", "idleAt", "ambientAt", "wakeAt",
        "lightRevertAt", "lastCueAt", "jedaAt", "noHandAt"].forEach(function (key) {
        if (typeof s[key] === "number" && Number.isFinite(s[key])) {
          s[key] += delta;
        }
      });
      return result([]);
    }

    function snapshot() {
      return {
        act: s.act,
        character: s.character,
        connected: s.connected,
        sound: s.sound,
        busy: s.busy,
        hand: s.hand,
        lastGesture: s.lastGesture,
        lastCueAt: s.lastCueAt,
        stateSince: s.stateSince,
        noHandAt: s.noHandAt,
        jedaAt: s.jedaAt,
        halfDone: s.halfDone,
        idleAt: s.idleAt,
        ambientAt: s.ambientAt,
        wakeAt: s.wakeAt,
      };
    }

    return {
      init: init,
      open: open,
      gesture: gesture,
      noHand: noHand,
      hand: hand,
      tick: tick,
      exitCharacter: exitCharacter,
      enterCharacter: enterCharacter,
      setCharacter: setCharacter,
      connection: connection,
      setSound: setSound,
      shift: shift,
      state: function () { return s.act; },
      snapshot: snapshot,
      TIMING: TIMING,
    };
  }

  return { create: create, TIMING: TIMING };
});
