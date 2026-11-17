/* Cultural reading stays local, sourced, quiet, and outside puppet controls. */
(function () {
  "use strict";
  let deck = null;
  let character = "gatotkaca";
  let category = "all";
  let selected = null;
  let previousOverflow = "";
  const $ = function (id) { return document.getElementById(id); };
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function isOpen() { return $("culture-panel") && !$("culture-panel").hidden; }

  function paintFact() {
    const fact = deck && deck.current();
    if (!fact) return;
    $("fact-title").textContent = fact.title;
    $("fact-text").textContent = fact.text;
    $("fact-counter").textContent = String(deck.facts.indexOf(fact) + 1).padStart(2, "0") + " / " + String(deck.facts.length).padStart(2, "0");
    $("fact-next").disabled = false;
    $("fact-detail").disabled = false;
  }
  function nextFact() { if (deck) { deck.next(character); paintFact(); } }

  function filters() {
    const container = $("culture-filters");
    const categories = Object.assign({ all: "Semua cerita" }, CultureCore.categories);
    Object.keys(categories).forEach(function (id) {
      const button = node("button", "", categories[id]);
      button.type = "button";
      button.dataset.category = id;
      button.setAttribute("aria-pressed", String(category === id));
      button.addEventListener("click", function () {
        category = id;
        selected = null;
        container.querySelectorAll("button").forEach(function (entry) { entry.setAttribute("aria-pressed", String(entry === button)); });
        renderEntries();
      });
      container.appendChild(button);
    });
  }

  function renderEntries() {
    const container = $("culture-entries");
    container.textContent = "";
    if (!deck) { $("culture-summary").textContent = "Cerita budaya belum dapat dimuat. Panggung tetap bisa dimainkan."; return; }
    const items = deck.filter(category);
    $("culture-summary").textContent = items.length + " cerita · dengan rujukan dan konteks daerah";
    items.forEach(function (fact) {
      const article = node("article", "culture-entry" + (selected === fact.id ? " is-selected" : ""));
      article.id = "culture-" + fact.id;
      article.appendChild(node("p", "eyebrow", CultureCore.categories[fact.category]));
      article.appendChild(node("h3", "", fact.title));
      article.appendChild(node("p", "", fact.text));
      article.appendChild(node("p", "fact-scope", fact.scope));
      const details = node("details");
      details.appendChild(node("summary", "", "Baca sumber penelitian"));
      fact.source_refs.forEach(function (ref) {
        const source = deck.sources.get(ref.source_id);
        const wrapper = node("p", "culture-source");
        const link = node("a", "", source.title);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        wrapper.append(link, document.createElement("br"), document.createTextNode((source.author || "Sumber penelitian") + " · " + (source.year || source.online_publication_year || String(source.published_on || "tanpa tahun").slice(0, 10)) + " · " + ref.locator));
        details.appendChild(wrapper);
      });
      article.appendChild(details);
      container.appendChild(article);
    });
  }

  function open(options) {
    const panel = $("culture-panel");
    if (isOpen()) return;
    selected = options && options.fact;
    category = "all";
    $("culture-filters").querySelectorAll("button").forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.category === category)); });
    renderEntries();
    panel.hidden = false;
    $("culture-backdrop").hidden = false;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (window.Teater) Teater.openPanel(panel, $("culture-close"), close);
    const target = options && options.credits ? $("culture-credits") : selected ? $("culture-" + selected) : null;
    if (target) target.scrollIntoView({ block: "start", behavior: "instant" });
    else panel.querySelector(".culture-content").scrollTop = 0;
  }
  function close() {
    if (!isOpen()) return;
    $("culture-panel").hidden = true;
    $("culture-backdrop").hidden = true;
    document.body.style.overflow = previousOverflow;
    if (window.Teater) Teater.closePanel($("culture-panel"));
  }

  document.addEventListener("DOMContentLoaded", async function () {
    document.querySelectorAll("[data-open-culture]").forEach(function (button) { button.addEventListener("click", function () { open(); }); });
    document.querySelectorAll("[data-open-credits]").forEach(function (button) { button.addEventListener("click", function () { open({ credits: true }); }); });
    $("culture-close").addEventListener("click", close);
    $("culture-backdrop").addEventListener("click", close);
    $("fact-next").addEventListener("click", nextFact);
    $("fact-detail").addEventListener("click", function () { if (deck && deck.current()) open({ fact: deck.current().id }); });
    function practice() { if (window.Dummy) Dummy.setActive(true); if (window.Teater) Teater.open(); }
    $("mulai-latihan").addEventListener("click", practice);
    $("latihan-sidebar").addEventListener("click", practice);
    $("buka-panduan-sidebar").addEventListener("click", function () { $("tombol-panduan").click(); });
    $("keluar-fullscreen").addEventListener("click", function () { if (window.Teater) Teater.toggleFullscreen(); });
    document.addEventListener("wayang:character", function (event) {
      if (event.detail.player !== 0) return;
      character = event.detail.character;
      if (!isOpen() && deck && deck.facts.some(function (fact) { return fact.character_ids.includes(character); })) nextFact();
    });
    try {
      const response = await fetch("data/culture.json");
      if (!response.ok) throw new Error("HTTP " + response.status);
      deck = CultureCore.create(await response.json());
      if (!deck.facts.length) throw new Error("tidak ada fakta yang memiliki sumber lengkap");
      filters();
      nextFact();
    } catch (error) {
      console.warn("[budaya] konten belum dapat dimuat", error);
      $("fact-title").textContent = "Cerita budaya belum tersedia.";
      $("fact-text").textContent = "Muat ulang halaman untuk mencoba lagi. Panggung tetap bisa dimainkan.";
      $("fact-counter").textContent = "—";
    }
  });
  window.Culture = { open: open, close: close, isOpen: isOpen };
})();
