import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const createSlots = require("../js/slots.js");

function tangan(id, x, extra) {
  return Object.assign({ id: id, wrist_x: x, confidence: 0.9, gesture: "ok" }, extra || {});
}

function jalankan(slots, hands, jumlah) {
  for (let i = 0; i < (jumlah || 1); i += 1) slots.assign(hands);
  return slots.assign(hands);
}

test("dua tangan di sisi berbeda langsung dapat dua slot", () => {
  const slots = createSlots({ jumlah: 2 });
  const hasil = slots.assign([tangan(0, 0.2), tangan(1, 0.8)]);
  assert.deepEqual(hasil, [0, 1]);
});

test("tangan yang lewat tengah belum pindah sampai bertahan 8 frame", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2)]);
  // lewat garis tengah sedikit: belum cukup jauh untuk dianggap pindah sisi.
  assert.deepEqual(slots.assign([tangan(0, 0.55)]), [0]);
  // sudah di sisi seberang, tapi baru 7 frame -> masih slot lama.
  for (let i = 0; i < 6; i += 1) slots.assign([tangan(0, 0.7)]);
  assert.deepEqual(slots.assign([tangan(0, 0.7)]), [0]);
  // frame ke-8 di sisi seberang -> pindah.
  assert.deepEqual(slots.assign([tangan(0, 0.7)]), [1]);
});

test("tangan kedua di sisi yang sama menempati slot kosong", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2)]);
  slots.assign([tangan(0, 0.2), tangan(1, 0.25)]);
  assert.deepEqual(slots.assign([tangan(0, 0.2), tangan(1, 0.25)]), [0, 1]);
});

test("slot bekas tangan yang keluar dipakai tangan baru di sisi yang sama", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2), tangan(1, 0.8)]);
  // tangan id 1 keluar panggung, tangan id 2 masuk di sisi kanan.
  const hasil = slots.assign([tangan(0, 0.2), tangan(2, 0.8)]);
  assert.deepEqual(hasil, [0, 1]);
});

test("lebih banyak tangan daripada wayang -> sisanya tanpa slot", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2), tangan(1, 0.3), tangan(2, 0.4)]);
  const hasil = slots.assign([tangan(0, 0.2), tangan(1, 0.3), tangan(2, 0.4)]);
  assert.deepEqual(hasil.filter((slot) => slot >= 0).length, 2);
  assert.equal(hasil[2], -1);
});

test("satu wayang: tangan yang datang lebih dulu memegang, sisanya tidak", () => {
  const slots = createSlots({ jumlah: 1 });
  assert.deepEqual(slots.assign([tangan(0, 0.7)]), [0]);
  assert.deepEqual(slots.assign([tangan(0, 0.7), tangan(1, 0.2)]), [0, -1]);
});

test("satu wayang: tangan kedua ambil alih setelah pegangannya lepas", () => {
  const slots = createSlots({ jumlah: 1 });
  slots.assign([tangan(0, 0.7)]);
  slots.assign([tangan(1, 0.2)]);
  assert.deepEqual(slots.assign([tangan(1, 0.2)]), [0]);
});

test("tangan yang hilang dibuang dari daftar slot", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2), tangan(1, 0.8)]);
  assert.deepEqual(slots.assign([tangan(0, 0.2)]), [0]);
  assert.deepEqual(slots.assign([tangan(0, 0.2), tangan(1, 0.8)]), [0, 1]);
});

test("ubah jumlah wayang membersihkan slot yang tidak dipakai lagi", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2), tangan(1, 0.8)]);
  slots.setJumlah(1);
  assert.deepEqual(slots.assign([tangan(0, 0.2), tangan(1, 0.8)]), [0, -1]);
  slots.setJumlah(2);
  assert.deepEqual(slots.assign([tangan(0, 0.2), tangan(1, 0.8)]), [0, 1]);
});

test("daftar tangan kosong berarti panggung kosong", () => {
  const slots = createSlots({ jumlah: 2 });
  slots.assign([tangan(0, 0.2)]);
  assert.deepEqual(slots.assign([]), []);
});
