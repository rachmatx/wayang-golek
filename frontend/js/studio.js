/* Visible play controls reuse the existing camera, practice and fullscreen actions. */
(function () {
  "use strict";
  const camera = document.getElementById('tombol-kamera');
  const practice = document.querySelector('[data-toggle-practice]');
  const enlarge = document.querySelector('[data-stage-fullscreen]');
  const guide = document.getElementById('studio-gesture-guide');
  if (window.matchMedia('(max-width: 1099px)').matches) guide.open = false;

  function sync() {
    const training = document.body.dataset.source === 'dummy';
    practice.setAttribute('aria-pressed', String(training));
    practice.querySelector('span').textContent = 'Latihan';
    practice.title = training ? 'Tutup mode latihan' : 'Buka mode latihan';
    const full = Boolean(document.fullscreenElement) || document.body.classList.contains('stage-focus');
    enlarge.setAttribute('aria-pressed', String(full));
    enlarge.setAttribute('aria-label', full ? 'Keluar layar penuh' : 'Perbesar panggung');
    enlarge.querySelector('span').textContent = full ? 'Perkecil' : 'Perbesar';
    document.querySelectorAll('[data-camera-toggle]').forEach(button => {
      const on = camera.dataset.on === 'true';
      button.dataset.on = String(on);
      button.setAttribute('aria-pressed', String(on));
      button.querySelector('[data-camera-label]').textContent = on ? 'Matikan kamera' : 'Nyalakan kamera';
    });
  }
  practice.addEventListener('click', () => {
    if (!window.Dummy) return;
    Dummy.toggle();
    if (Dummy.isActive() && window.Teater) Teater.open();
  });
  enlarge.addEventListener('click', () => { if (window.Teater) Teater.toggleFullscreen(); });
  document.querySelectorAll('[data-camera-toggle]').forEach(button => button.addEventListener('click', () => camera.click()));
  new MutationObserver(sync).observe(camera, { attributes: true, attributeFilter: ['data-on'] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-source', 'class'] });
  document.addEventListener('fullscreenchange', sync);
  sync();
})();
