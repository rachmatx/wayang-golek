/* Channel levels are separate from the existing master/music/dialog preferences. */
(function (root) {
  "use strict";
  const key = "wayang-audio-levels-v1";
  const defaults = { dialog: 0.85, musik: 0.28, sfx: 0.7 };
  function read(storage) {
    let saved;
    try { saved = JSON.parse(storage.getItem(key)); } catch (_) { /* Optional storage. */ }
    const levels = {};
    Object.keys(defaults).forEach(channel => {
      const value = saved && saved[channel];
      levels[channel] = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : defaults[channel];
    });
    return levels;
  }
  function write(storage, levels) {
    try { storage.setItem(key, JSON.stringify(levels)); } catch (_) { /* Session still works. */ }
  }
  const api = { read, write, defaults };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AudioPrefs = api;
})(typeof window === "undefined" ? globalThis : window);
