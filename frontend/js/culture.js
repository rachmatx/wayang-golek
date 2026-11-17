/* Cultural reading stays local, sourced, quiet, and outside puppet controls. */
(function () {
  "use strict";
  let deck = null;
  let character = "gatotkaca";
  let category = "all";
  let selected = null;
  let previousOverflow = "";
  let timer = null;
  let autoEnabled = true;
  const $ = function (id) { return document.getElementById(id); };
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function isOpen() { return $("culture-panel") && !$("culture-panel").hidden; }

  function paintFact(announce) {
    const fact = deck && deck.current();
    if (!fact) return;
    const copy = document.querySelector(".fact-copy");
    copy.setAttribute("aria-live", announce ? "polite" : "off");
    document.querySelector(".culture-strip").dataset.fact = fact.id;
    copy.classList.remove("fact-updated");
    void copy.offsetWidth;
    copy.classList.add("fact-updated");
    $("fact-title").textContent = fact.title;
    $("fact-text").textContent = fact.text;
    $("fact-counter").textContent = String(deck.facts.indexOf(fact) + 1).padStart(2, "0") + " / " + String(deck.facts.length).padStart(2, "0");
    $("fact-next").disabled = deck.facts.length < 2;
    $("fact-previous").disabled = !deck.canPrevious();
    $("fact-pause").disabled = deck.facts.length < 2;
    $("fact-detail").disabled = false;
    if (timer) timer.reset(performance.now());
  }
  function nextFact(announce) { if (deck) { deck.next(character); paintFact(announce); } }
  function previousFact() { if (deck) { deck.previous(); paintFact(true); } }
  function paintTimer() {
    if (!timer) return;
    const button = $("fact-pause");
    button.dataset.enabled = String(autoEnabled);
    button.setAttribute("aria-label", autoEnabled ? "Jeda pergantian fakta" : "Aktifkan pergantian fakta otomatis");
    const label = autoEnabled ? "Jeda" : "Putar";
    if (button.querySelector("span").textContent !== label) button.querySelector("span").textContent = label;
    const text = !autoEnabled ? "Mode manual" : timer.paused() ? "Otomatis dijeda" : "Berikutnya " + Math.ceil(timer.remaining()/1000) + " dtk";
    if ($("fact-timing").textContent !== text) $("fact-timing").textContent = text;
    $("fact-progress").value = 30-timer.remaining()/1000;
  }
  function setupRotation() {
    const strip = document.querySelector(".culture-strip");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { const stored=localStorage.getItem("wayang-facts-auto"); autoEnabled=stored ? stored!=="mati" : !reduced; } catch (_) { autoEnabled=!reduced; }
    timer=FactTimer.create(30000,performance.now());
    const pause = (reason,on) => { timer.pause(reason,on,performance.now()); paintTimer(); };
    pause("user",!autoEnabled); pause("offscreen",true);
    pause("single",deck.facts.length<2);
    function visibility() { pause("hidden",document.hidden); }
    visibility(); document.addEventListener("visibilitychange",visibility);
    new IntersectionObserver(entries => { pause("offscreen",!entries[0].isIntersecting || entries[0].intersectionRatio<.25); },{threshold:[0,.25]}).observe(strip);
    const app=document.querySelector(".app");
    const modal=()=>pause("modal",app.hasAttribute("inert"));
    new MutationObserver(modal).observe(app,{attributes:true,attributeFilter:["inert"]}); modal();
    strip.addEventListener("pointerenter",event=>{ if(event.pointerType!=="touch") pause("pointer",true); });
    strip.addEventListener("pointerleave",()=>pause("pointer",false));
    strip.addEventListener("focusin",event=>{ if(event.target.matches(":focus-visible")) pause("focus",true); });
    strip.addEventListener("focusout",event=>{ if(!strip.contains(event.relatedTarget)) pause("focus",false); });
    $("fact-pause").addEventListener("click",()=>{
      autoEnabled=!autoEnabled;
      try { localStorage.setItem("wayang-facts-auto",autoEnabled?"nyala":"mati"); } catch (_) {}
      pause("user",!autoEnabled);
      if(autoEnabled) { pause("pointer",false); pause("focus",false); timer.reset(performance.now()); }
      paintTimer();
    });
    setInterval(()=>{ if(timer.tick(performance.now())) nextFact(false); paintTimer(); },500);
    paintTimer();
  }

  function stabilizeFactHeight() {
    const copy=document.querySelector(".fact-copy");
    const probe=node("div","fact-measure"); probe.setAttribute("aria-hidden","true");
    const title=node("h2"),text=node("p"); probe.append(title,text); copy.appendChild(probe);
    function measure() {
      let height=0;
      deck.facts.forEach(fact=>{title.textContent=fact.title;text.textContent=fact.text;height=Math.max(height,probe.getBoundingClientRect().height);});
      copy.style.minHeight=Math.ceil(height)+"px";
    }
    let width=0;
    new ResizeObserver(()=>{if(copy.clientWidth!==width){width=copy.clientWidth;measure();}}).observe(copy);
    if(document.fonts) document.fonts.ready.then(measure);
    measure();
  }

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
    $("fact-next").addEventListener("click", function () { nextFact(true); });
    $("fact-previous").addEventListener("click", previousFact);
    $("fact-detail").addEventListener("click", function () { if (deck && deck.current()) open({ fact: deck.current().id }); });
    function practice() { if (window.Dummy) Dummy.setActive(true); if (window.Teater) Teater.open(); }
    $("mulai-latihan").addEventListener("click", practice);
    $("latihan-sidebar").addEventListener("click", practice);
    $("buka-panduan-sidebar").addEventListener("click", function () { $("tombol-panduan").click(); });
    $("keluar-fullscreen").addEventListener("click", function () { if (window.Teater) Teater.toggleFullscreen(); });
    document.addEventListener("wayang:character", function (event) {
      if (event.detail.player !== 0) return;
      character = event.detail.character;
      // Character context affects the next selection, never interrupts the current reading.
    });
    try {
      const response = await fetch("data/culture.json");
      if (!response.ok) throw new Error("HTTP " + response.status);
      deck = CultureCore.create(await response.json());
      if (!deck.facts.length) throw new Error("tidak ada fakta yang memiliki sumber lengkap");
      filters();
      nextFact(false);
      setupRotation();
      stabilizeFactHeight();
    } catch (error) {
      console.warn("[budaya] konten belum dapat dimuat", error);
      $("fact-title").textContent = "Cerita budaya belum tersedia.";
      $("fact-text").textContent = "Muat ulang halaman untuk mencoba lagi. Panggung tetap bisa dimainkan.";
      $("fact-counter").textContent = "—";
    }
  });
  window.Culture = { open: open, close: close, isOpen: isOpen };
})();
