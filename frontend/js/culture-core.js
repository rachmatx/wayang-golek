/* Pure content validation and fact selection. No network, DOM or timers. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CultureCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CATEGORIES = {
    daerah_cengkok: "Daerah & cengkok",
    tokoh: "Tokoh",
    musik_gerak: "Musik & gerak",
    tradisi_masyarakat: "Tradisi masyarakat",
  };

  function normalize(data) {
    const sources = new Map();
    (data && Array.isArray(data.sources) ? data.sources : []).forEach(function (source) {
      if (source && typeof source.id === "string" && typeof source.title === "string"
        && typeof source.url === "string" && /^https:\/\//.test(source.url)) sources.set(source.id, source);
    });
    const ids = new Set();
    const facts = (data && Array.isArray(data.facts) ? data.facts : []).filter(function (fact) {
      if (!fact || typeof fact.id !== "string" || ids.has(fact.id)) return false;
      if (![fact.title, fact.text, fact.scope].every(function (value) { return typeof value === "string" && value.trim(); })) return false;
      if (!CATEGORIES[fact.category] || !Array.isArray(fact.source_refs) || !fact.source_refs.length) return false;
      if (!fact.source_refs.every(function (ref) { return ref && sources.has(ref.source_id) && typeof ref.locator === "string" && ref.locator; })) return false;
      ids.add(fact.id);
      return true;
    }).map(function (fact) {
      return Object.assign({}, fact, { character_ids: Array.isArray(fact.character_ids) ? fact.character_ids : [] });
    });
    return { sources: sources, facts: facts };
  }

  function create(data, random) {
    const content = normalize(data);
    const rng = typeof random === "function" ? random : Math.random;
    const seen = new Set();
    let current = null;
    function next(character) {
      if (!content.facts.length) return null;
      let remaining = content.facts.filter(function (fact) { return !seen.has(fact.id); });
      if (!remaining.length) { seen.clear(); remaining = content.facts.slice(); }
      const different = remaining.filter(function (fact) { return !current || fact.id !== current.id; });
      if (different.length) remaining = different;
      const related = remaining.filter(function (fact) { return fact.character_ids.includes(character); });
      const candidates = related.length ? related : remaining;
      const position = Math.max(0, Math.min(candidates.length - 1, Math.floor(Number(rng()) * candidates.length) || 0));
      current = candidates[position];
      seen.add(current.id);
      return current;
    }
    return {
      facts: content.facts,
      sources: content.sources,
      next: next,
      current: function () { return current; },
      filter: function (category) { return content.facts.filter(function (fact) { return !category || category === "all" || fact.category === category; }); },
    };
  }
  return { create: create, normalize: normalize, categories: CATEGORIES };
});
