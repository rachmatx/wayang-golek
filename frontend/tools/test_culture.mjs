import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const Culture = require("../js/culture-core.js");
const data = JSON.parse(fs.readFileSync(new URL("../data/culture.json", import.meta.url), "utf8"));

test("semua 12 fakta memiliki kategori, cakupan, sumber https dan locator yang valid", () => {
  const content = Culture.normalize(data);
  assert.equal(content.facts.length, 12);
  assert.equal(content.sources.size, 7);
  assert.equal(new Set(content.facts.map(fact => fact.id)).size, 12);
});

test("satu putaran habis sebelum fakta diulang, termasuk saat tokoh berubah", () => {
  const deck = Culture.create(data, () => 0);
  const shown = [];
  for (let i = 0; i < 12; i++) shown.push(deck.next(i % 2 ? "semar" : "gatotkaca").id);
  assert.equal(new Set(shown).size, 12);
  assert.notEqual(deck.next().id, shown.at(-1));
});

test("konteks tokoh diprioritaskan tanpa menghilangkan fakta lain", () => {
  const deck = Culture.create(data, () => 0);
  assert.ok(deck.next("semar").character_ids.includes("semar"));
  assert.notEqual(deck.next("semar").id, "jatim-007");
  assert.ok(deck.next("gatotkaca").character_ids.includes("gatotkaca"));
});

test("filter kategori tidak mengubah bacaan atau histori pilihan kartu", () => {
  const deck = Culture.create(data, () => 0);
  const first = deck.next();
  assert.equal(deck.filter("tokoh").length, 2);
  assert.equal(deck.filter("musik_gerak").length, 3);
  assert.equal(deck.filter("all").length, 12);
  assert.equal(deck.current(), first);
  assert.notEqual(deck.next().id, first.id);
});

test("sumber tidak aman, rujukan putus dan fakta duplikat tidak masuk koleksi", () => {
  const invalid = structuredClone(data);
  invalid.sources[0].url = "javascript:alert(1)";
  invalid.facts.push(structuredClone(invalid.facts[5]));
  invalid.facts[4].source_refs = [{ source_id: "missing", locator: "p1" }];
  const content = Culture.normalize(invalid);
  assert.equal(content.sources.size, 6);
  assert.equal(content.facts.length, 8);
});

test("data hilang, bentuk salah, serta koleksi satu fakta tetap aman", () => {
  assert.equal(Culture.create(null).next(), null);
  assert.equal(Culture.create({ sources: {}, facts: {} }).next(), null);
  const one = Culture.create({ sources: data.sources, facts: [data.facts[0]] });
  assert.equal(one.next().id, one.next().id);
});

test("sampling ekstrem tetap memilih entri yang valid", () => {
  for (const value of [-2, 1, 99, NaN]) {
    assert.ok(Culture.create(data, () => value).next().id);
  }
});
