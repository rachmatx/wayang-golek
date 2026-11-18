/* A dismissible inline guide; it never blocks the stage or starts a camera. */
(function() {
  'use strict';
  const guide = document.getElementById('start-guide');
  const practice = document.getElementById('start-practice');
  const gestures = document.getElementById('studio-gesture-guide');
  try { guide.open = localStorage.getItem('wayang-start-guide') !== 'selesai'; } catch (_) {}
  function compact() { if (guide.open) gestures.open = false; }
  guide.addEventListener('toggle', compact);
  gestures.addEventListener('toggle', () => { if (gestures.open) guide.open = false; });
  compact();
  document.addEventListener('wayang:ready', () => { practice.disabled = false; });
  practice.addEventListener('click', () => { Dummy.setActive(true); document.getElementById('panggung').scrollIntoView({block:'start',behavior:'instant'}); });
  document.getElementById('start-calibrate').addEventListener('click', () => {
    const tuning = document.getElementById('control-tuning');
    tuning.open = true; guide.open = false; tuning.querySelector('summary').focus();
  });
  document.getElementById('start-dismiss').addEventListener('click', () => {
    guide.querySelector('summary').focus(); guide.open = false;
    try { localStorage.setItem('wayang-start-guide','selesai'); } catch (_) {}
  });
})();
