/* Digital movement phrases, inspired by rod-operated shadow puppetry.
 * The body stays rigid; expression comes from the gapit pivot and arm joints.
 * These are authored interpretations, not motion capture or a named dalang's sabet.
 */
(function (root) {
  'use strict';
  const profiles = {
    gatotkaca: { tempo: 1.08, arms: 1, stride: 112, lift: 10, lean: 4.8 },
    semar: { tempo: .82, arms: .78, stride: 92, lift: 5, lean: 3.1 },
    bagong: { tempo: 1.2, arms: 1.08, stride: 82, lift: 12, lean: 5.5 },
  };
  // Channels: rear shoulder, rear elbow, front shoulder, front elbow, body, lift.
  const phrases = {
    telapak_terbuka: [
      [0, 0, 0, 0, 0, 0, 0], [.16, -7, 8, 5, -5, -1.4, 0],
      [.52, 76, -146, -56, 110, 2.8, 5], [.76, 68, -125, -49, 100, 1.1, 0],
      [1.08, 80, -151, -61, 121, 2, 2], [1.5, 62, -124, -43, 92, 0, 0],
    ],
    dua_jari: [
      [0, 0, 0, 0, 0, 0, 0], [.2, 38, -100, -7, 10, -1.5, 0],
      [.38, 52, -140, -12, 17, 1.8, 3], [.52, 40, -84, -7, 8, 0, 0],
      [.72, 49, -134, -10, 15, 1.3, 2], [.9, 39, -86, -6, 8, 0, 0],
      [1.22, 43, -108, -8, 12, 0, 0],
    ],
    jempol: [
      [0, 0, 0, 0, 0, 0, 0], [.28, 54, -130, -54, 130, -1, 0],
      [.68, 65, -145, -65, 145, 9, 0], [1, 65, -145, -65, 145, 9, 0],
      [1.38, 40, -100, -40, 100, 0, 0], [1.7, 0, 0, 0, 0, 0, 0],
    ],
    ok: [
      [0, 0, 0, 0, 0, 0, 0], [.12, -9, 18, 10, -14, -3, 0],
      [.3, 15, -28, -17, 26, 3, 9], [.52, 8, -13, -8, 12, 0, 0],
      [.82, 0, 0, 0, 0, 0, 0],
    ],
  };
  const zero = [0, 0, 0, 0, 0, 0];
  function track(frames, time) {
    if (time <= frames[0][0]) return frames[0].slice(1);
    for (let i = 1; i < frames.length; i++) {
      if (time > frames[i][0]) continue;
      const a = frames[i - 1], b = frames[i];
      const u = (time - a[0]) / (b[0] - a[0]);
      const ease = u * u * (3 - 2 * u);
      return a.slice(1).map((value, channel) => value + (b[channel + 1] - value) * ease);
    }
    return frames[frames.length - 1].slice(1);
  }
  function sample(pose, elapsed, options) {
    const opts = options || {};
    const profile = profiles[opts.character] || profiles.gatotkaca;
    const time = Math.max(0, Number(elapsed) || 0) * profile.tempo;
    const frames = phrases[pose];
    let values = frames ? track(frames, opts.reduced ? Infinity : time) : zero.slice();
    if (opts.reduced && pose === 'jempol') values = [54, -130, -54, 130, 7, 0];
    if (!opts.reduced && pose === 'telunjuk') {
      const speed = Number.isFinite(opts.speed) ? opts.speed : 0;
      const amount = Math.min(1, Math.abs(speed) / 180);
      const stride = Number.isFinite(opts.stride) ? opts.stride : 0;
      const swing = Math.sin(stride) * amount;
      const direction = Math.sign(speed) * (opts.facing === -1 ? -1 : 1);
      values = [swing * 23 - direction * amount * 7, -12 * amount - swing * 16,
        -swing * 27 + direction * amount * 6, 15 * amount + swing * 20,
        direction * amount * profile.lean + swing * 1.6,
        Math.abs(Math.sin(stride)) * amount * profile.lift];
    }
    // A held greeting has a brief wrist accent followed by a long readable pause.
    if (!opts.reduced && pose === 'telapak_terbuka' && time > 2.4) {
      const cycle = (time - 2.4) % 3.6;
      const accent = cycle < .65 ? Math.sin(cycle / .65 * Math.PI) : 0;
      values[1] -= accent * 12;
      values[3] += accent * 7;
    }
    const angles = values.slice(0, 4).map(value => value * profile.arms);
    return { angles, body: values[4], lift: opts.reduced ? 0 : values[5], strideLength: profile.stride };
  }
  const api = { sample, profiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WayangPuppetry = api;
})(typeof window === 'undefined' ? globalThis : window);
