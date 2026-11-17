/* Screen-space travel and analytically integrated critically damped springs. */
(function (root) {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function bounds(stageWidth, centre, halfPuppet, margin) {
    return { min: Math.min(0, margin + halfPuppet - centre),
      max: Math.max(0, stageWidth - margin - halfPuppet - centre) };
  }
  function follow(wrist, range) {
    // Most webcams are awkward near their edges. 20–80% reaches the full stage.
    const value = clamp((wrist - 0.5) / 0.3, -1, 1);
    const normalized = Math.abs(value) < 0.035 ? 0 : Math.sign(value) * (Math.abs(value) - 0.035) / 0.965;
    return normalized < 0 ? -normalized * range.min : normalized * range.max;
  }
  function spring(state, target, dt, frequency) {
    const offset = state.x - target;
    const coefficient = state.v + frequency * offset;
    const decay = Math.exp(-frequency * dt);
    state.x = target + (offset + coefficient * dt) * decay;
    state.v = (state.v - frequency * coefficient * dt) * decay;
    return state;
  }
  const api = { clamp, bounds, follow, spring };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WayangMotion = api;
})(typeof window === "undefined" ? globalThis : window);
