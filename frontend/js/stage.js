/* Scene controls remain local; stored preference never includes camera data. */
(function () {
  "use strict";
  const stage = document.getElementById("panggung");
  const buttons = Array.from(document.querySelectorAll("button[data-scene]"));
  function select(scene) {
    if (!["pendopo", "rimba"].includes(scene)) scene = "pendopo";
    stage.dataset.scene = scene;
    buttons.forEach(button => {
      const selected = button.dataset.scene === scene;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("scene-description").textContent = scene === "pendopo" ? "Cahaya hangat, cerita yang dekat." : "Di bawah rembulan, lakon berlanjut.";
    try { localStorage.setItem("wayang-scene", scene); } catch (_) { /* Storage optional. */ }
  }
  buttons.forEach(button => button.addEventListener("click", () => select(button.dataset.scene)));
  try { select(localStorage.getItem("wayang-scene")); } catch (_) { select("pendopo"); }
  document.addEventListener("wayang:gesture", event => {
    document.querySelectorAll("[data-guide-gesture]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.guideGesture === event.detail.gesture);
    });
  });
})();
