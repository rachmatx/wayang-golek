/* Screen-space travel and analytically integrated critically damped springs. */
(function (root) {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function bounds(stageWidth, centre, halfPuppet, margin) {
    return { min: Math.min(0, margin + halfPuppet - centre),
      max: Math.max(0, stageWidth - margin - halfPuppet - centre) };
  }
  function follow(wrist, range, settings) {
    if (!Number.isFinite(wrist)) return 0;
    const centre=settings&&Number.isFinite(settings.centre)?clamp(settings.centre,.1,.9):.5;
    const span=settings&&Number.isFinite(settings.span)?clamp(settings.span,.15,.45):.3;
    const delta=wrist-centre;
    // Keep both stage edges reachable even when the neutral hand is off-centre.
    const available=delta<0?centre-.03:.97-centre;
    const value=clamp(delta/Math.min(span,available),-1,1);
    const normalized=Math.abs(value)<.035?0:Math.sign(value)*(Math.abs(value)-.035)/.965;
    return normalized<0?-normalized*range.min:normalized*range.max;
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
