/* One accessible mixer, shared by stage and settings; keep playback audible while mixing. */
(function () {
  "use strict";
  const panel = document.getElementById("audio-panel");
  const backdrop = document.getElementById("audio-backdrop");
  const closeButton = document.getElementById("audio-close");
  const triggers = document.querySelectorAll("[data-open-audio]");
  let previousOverflow = "";
  function close() {
    if (panel.hidden) return;
    panel.hidden = backdrop.hidden = true;
    document.body.style.overflow = previousOverflow;
    triggers.forEach(button => button.setAttribute("aria-expanded", "false"));
    Teater.closePanel(panel);
  }
  function open() {
    if (!panel.hidden) return;
    panel.hidden = backdrop.hidden = false;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    triggers.forEach(button => button.setAttribute("aria-expanded", "true"));
    Teater.openPanel(panel, closeButton, close, { keepAudio: true });
  }
  triggers.forEach(button => button.addEventListener("click", open));
  backdrop.addEventListener("click", close);
  closeButton.addEventListener("click", close);
  document.getElementById("audio-master").addEventListener("click", () => Teater.setSound(!Teater.soundEnabled()));
})();
