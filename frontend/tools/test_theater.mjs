import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TeaterCore = require("../js/theater-core.js");

function karakterFixture() {
  return {
    gestur: {
      telapak_terbuka: ["A1", "A2"],
      kepalan: ["B1", "B2"],
      telunjuk: ["C1", "C2"],
      dua_jari: ["D1", "D2"],
      jempol: ["E1", "E2"],
      ok: ["F1", "F2"],
    },
    suasana: {
      sambutan: ["S1"],
      sambutan2: ["S2"],
      bangun: ["BANGUN"],
      tidur: ["TIDUR"],
      masuk: ["MASUK"],
      keluar: ["KELUAR"],
      sambung: ["SAMBUNG"],
      idle: ["I1", "I2", "I3"],
      half: ["HALF"],
    },
  };
}

function fixture() {
  return {
    label: {
      klasik: "Klasik",
      arjuna: "Arjuna",
      gatotkaca: "Gatotkaca",
      cepot: "Cepot",
    },
    karakter: {
      klasik: karakterFixture(),
      arjuna: karakterFixture(),
      gatotkaca: karakterFixture(),
      cepot: karakterFixture(),
    },
  };
}

function make() {
  let n = 0.11;
  const core = TeaterCore.create({
    dialog: fixture(),
    random: function () {
      n = (n + 0.17) % 1;
      return n;
    },
  });
  core.init({ character: "klasik" });
  return core;
}

function open(core) {
  core.open("gesture", 1000);
  return core;
}

function find(result, type) {
  return result.effects.find(function (effect) { return effect.type === type; });
}

function all(result, type) {
  return result.effects.filter(function (effect) { return effect.type === type; });
}

test("init membuka di babak pembuka dengan tirai tertutup", function () {
  const core = make();
  assert.equal(core.state(), "pembuka");
  const snap = core.snapshot();
  assert.equal(snap.character, "klasik");
  assert.equal(snap.act, "pembuka");
});

test("gestur apa pun membuka panggung tanpa bungkuk", function () {
  const core = make();
  const result = core.open("gesture", 1000);
  assert.equal(core.state(), "live");
  const curtain = find(result, "curtain");
  assert.equal(curtain.open, true);
  assert.equal(find(result, "sound").cue, "buka");
  assert.equal(find(result, "bow"), undefined);
});

test("tombol buka menambah bungkuk singkat", function () {
  const core = make();
  const result = core.open("button", 1000);
  assert.equal(core.state(), "live");
  assert.ok(find(result, "bow"));
});

test("balon sambutan muncul setelah 800 ms di pembuka", function () {
  const core = make();
  assert.equal(all(core.tick(799), "bubble").length, 0);
  const result = core.tick(800);
  assert.equal(find(result, "bubble").text, "S1");
});

test("tanpa tangan 2 detik memindahkan babak ke jeda", function () {
  const core = open(make());
  core.noHand(2000);
  assert.equal(core.tick(3999).effects.some(function (e) { return e.type === "idle"; }), false);
  assert.equal(core.state(), "live");
  const result = core.tick(4000);
  assert.equal(core.state(), "jeda");
  assert.equal(find(result, "idle").on, true);
  assert.equal(find(result, "light").level, "idle");
});

test("gestur saat jeda membangunkan dengan balon bangun lalu cue", function () {
  const core = open(make());
  core.noHand(2000);
  core.tick(4000);
  const result = core.gesture({ gesture: "ok" }, 5000);
  assert.equal(core.state(), "live");
  const bubbles = all(result, "bubble");
  assert.equal(bubbles.length, 2);
  assert.equal(bubbles[0].text, "BANGUN");
  assert.equal(bubbles[1].delay, 900);
});

test("tirai setengah dan balon 45 detik muncul sekali", function () {
  const core = open(make());
  core.noHand(2000);
  core.tick(4000);
  const result = core.tick(47000);
  const curtain = find(result, "curtain");
  assert.equal(curtain.half, true);
  assert.equal(find(result, "bubble").text, "HALF");
  const again = core.tick(48000);
  assert.equal(find(again, "curtain"), undefined);
  assert.equal(all(again, "bubble").some(function (e) { return e.text === "HALF"; }), false);
});

test("90 detik tanpa gestur memindahkan babak ke tidur", function () {
  const core = open(make());
  core.noHand(2000);
  core.tick(4000);
  const result = core.tick(92000);
  assert.equal(core.state(), "tidur");
  assert.equal(find(result, "sound").cue, "tidur");
  assert.equal(find(result, "light").level, "off");
});

test("gestur saat tidur membuka pembuka singkat lalu live otomatis", function () {
  const core = open(make());
  core.noHand(2000);
  core.tick(4000);
  core.tick(92000);
  const result = core.gesture({ gesture: "telapak_terbuka" }, 93000);
  assert.equal(core.state(), "pembuka");
  assert.equal(find(result, "bubble").text, "BANGUN");
  const before = core.tick(95499);
  assert.equal(find(before, "curtain"), undefined);
  assert.equal(core.state(), "pembuka");
  core.tick(95500);
  assert.equal(core.state(), "live");
});

test("gestur netral tidak memicu dialog atau suara", function () {
  const core = open(make());
  const result = core.gesture({ gesture: "netral" }, 5000);
  assert.equal(all(result, "bubble").length, 0);
  assert.equal(find(result, "sound"), undefined);
});

test("gestur sama berturut-turut tidak memicu cue ulang", function () {
  const core = open(make());
  core.gesture({ gesture: "telapak_terbuka" }, 5000);
  const result = core.gesture({ gesture: "telapak_terbuka" }, 9000);
  assert.equal(result.effects.length, 0);
});

test("cue dalam 2,5 detik hanya mengganti balon", function () {
  const core = open(make());
  core.gesture({ gesture: "telapak_terbuka" }, 5000);
  const result = core.gesture({ gesture: "kepalan" }, 6000);
  assert.equal(all(result, "bubble").length, 1);
  assert.equal(find(result, "sound"), undefined);
  assert.equal(find(result, "light"), undefined);
});

test("varian dialog tidak mengulang varian terakhir", function () {
  const core = open(make());
  const first = find(core.gesture({ gesture: "telapak_terbuka" }, 5000), "bubble").text;
  core.gesture({ gesture: "ok" }, 8000);
  const second = find(core.gesture({ gesture: "telapak_terbuka" }, 11000), "bubble").text;
  assert.notEqual(first, second);
  assert.ok(["A1", "A2"].includes(first));
  assert.ok(["A1", "A2"].includes(second));
});

test("transisi karakter mengunci gestur sampai wayang baru masuk", function () {
  const core = open(make());
  const exit = core.exitCharacter(5000);
  assert.equal(core.snapshot().busy, true);
  assert.ok(find(exit, "exit-character"));
  const blocked = core.gesture({ gesture: "ok" }, 5200);
  assert.equal(blocked.effects.length, 0);
  assert.equal(core.state(), "live");

  const enter = core.setCharacter("cepot", 6000);
  assert.equal(core.snapshot().busy, false);
  assert.equal(find(enter, "character").key, "cepot");
  assert.ok(find(enter, "enter-character"));
  assert.equal(find(enter, "bubble").text, "MASUK");
});

test("putus dan sambung kembali memakai pita dan balon sambung", function () {
  const core = open(make());
  const down = core.connection("disconnected", 5000);
  assert.equal(find(down, "ribbon").visible, true);
  const muted = core.gesture({ gesture: "ok" }, 6000);
  assert.equal(muted.effects.length, 0);

  const up = core.connection("connected", 7000);
  assert.equal(find(up, "ribbon").visible, false);
  assert.equal(find(up, "bubble").text, "SAMBUNG");
});

test("shift menunda timer saat tab disembunyikan", function () {
  const core = open(make());
  core.noHand(2000);
  core.tick(4000);
  core.shift(60000);
  const early = core.tick(100000);
  assert.equal(core.state(), "jeda");
  assert.equal(find(early, "sound"), undefined);
  core.tick(152000);
  assert.equal(core.state(), "tidur");
});

test("ambient hanya muncul dalam jendela 20–40 detik", function () {
  const core = open(make());
  const early = core.tick(1000 + 19999);
  assert.equal(find(early, "ambient"), undefined);
  const later = core.tick(1000 + 40000);
  assert.ok(find(later, "ambient"));
});

const Dialog = require("../js/dialog.js");

test("naskah dialog lengkap untuk empat karakter", function () {
  const gestur = ["telapak_terbuka", "kepalan", "telunjuk", "dua_jari", "jempol", "ok"];
  const suasana = ["sambutan", "sambutan2", "bangun", "tidur", "masuk", "keluar", "sambung", "idle", "half"];
  ["klasik", "arjuna", "gatotkaca", "cepot"].forEach(function (key) {
    const naskah = Dialog.karakter[key];
    assert.ok(naskah, "karakter " + key + " ada");
    gestur.forEach(function (name) {
      assert.equal(naskah.gestur[name].length, 2, key + " " + name + " punya dua varian");
    });
    suasana.forEach(function (name) {
      assert.ok(naskah.suasana[name].length >= 1, key + " " + name + " terisi");
    });
    Object.values(naskah.gestur).forEach(function (lines) {
      lines.forEach(function (line) {
        assert.ok(line.length <= 70, "baris gestur <= 70: " + line);
      });
    });
    Object.values(naskah.suasana).forEach(function (lines) {
      lines.forEach(function (line) {
        assert.ok(line.length <= 70, "baris suasana <= 70: " + line);
      });
    });
  });
});
