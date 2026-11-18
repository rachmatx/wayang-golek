/* Input feedback is independent of gesture filtering and puppet animation. */
(function(root) {
  'use strict';
  function presence() {
    let present = null;
    return {
      update(count) {
        const next = count > 0;
        if (next === present) return null;
        present = next;
        return next ? 'wayang:hand' : 'wayang:nohand';
      },
      reset() { present = null; },
    };
  }
  function status(input, now) {
    const s = input || {};
    const result = (state, title, hint) => ({state, title, hint});
    if (s.source === 'dummy') return result('practice', 'Mode latihan', 'Pilih gerak lewat tombol atau angka 1–6. Klik lagi untuk mengulang.');
    if (s.connection !== 'connected') return result('disconnected', 'Backend belum terhubung', 'Menunggu layanan kamera. Latihan tanpa kamera tetap bisa dimainkan.');
    if (s.intent === false) return result('off', 'Kamera dimatikan', 'Nyalakan kamera atau pilih latihan tanpa kamera.');
    if (s.camera === false) return result('unavailable', 'Kamera tidak tersedia', 'Periksa izin atau pilih sumber lain di Pengaturan. Kamu tetap bisa memakai latihan.');
    if (s.camera !== true) return result('checking', 'Memeriksa kamera', 'Menunggu kabar kamera dari komputer yang menjalankan aplikasi.');
    if (s.tracker === false) return result('tracker', 'Pelacak tangan belum siap', 'Jalankan pemeriksaan instalasi atau gunakan latihan tanpa kamera.');
    if (s.modelLoaded === false) return result('model', 'Pengenal gestur belum siap', 'Periksa model di Pengaturan atau gunakan latihan tanpa kamera.');
    if (!Number.isFinite(s.lastPredictionAt) || now - s.lastPredictionAt > 3000) return result('stale', 'Menunggu data gerakan', 'Kamera tersedia, tetapi data gerakan belum masuk. Tahan sebentar atau coba latihan.');
    const hands = Array.isArray(s.hands) ? s.hands : [];
    const visible = hands.filter(Boolean);
    if (!visible.length) return result('no_hand', 'Tangan belum terlihat', 'Posisikan tangan di depan kamera. Pastikan cahaya cukup dan jari terlihat utuh.');
    const accepted = visible.some(hand => hand.state === 'ok' && hand.gesture);
    return result(accepted ? 'accepted' : 'holding', accepted ? 'Gestur diterima' : 'Tahan pose sebentar',
      hands.map((hand, index) => 'P' + (index + 1) + ': ' + (!hand ? 'belum terlihat' : hand.state === 'ok' && hand.gesture ? (s.label ? s.label(hand.gesture) : hand.gesture) : 'tahan pose')).join(' · '));
  }
  const api = {presence, status};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InputCore = api;
})(typeof window === 'undefined' ? globalThis : window);
