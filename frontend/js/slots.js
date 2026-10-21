/* slots.js — mengikat id tangan dari backend ke wayang di panggung.

Backend mengirim tangan dengan id yang stabil (hand_tracker.py). Berkas ini
yang memutuskan id mana mengendalikan wayang ke berapa:

  - panggung dibagi dua: wrist_x < 0,5 -> wayang kiri, sisanya wayang kanan
  - tangan yang sudah memegang satu wayang tidak ikut pindah cuma karena
    lewat tengah: baru pindah kalau bertahan 8 frame di seberang garis,
    dan garis pindahnya diberi toleransi 0,06 (histeresis)
  - dua tangan di sisi yang sama: yang sudah pegang tetap pegang, yang baru
    mengambil wayang yang masih kosong
  - panggung satu wayang: tangan yang datang lebih dulu memegang; tangan
    keduanya tetap dikirim ke browser untuk strip status, tidak menggerakkan
    wayang
*/
(function () {
  "use strict";

  const GARIS_TENGAH = 0.5;
  const HISTERESIS = 0.06;
  const TAHAN_FRAME = 8;

  function createSlots(options) {
    const start = options || {};
    let jumlah = Math.max(1, Number(start.jumlah) || 2);
    const histeresis = Number(start.histeresis) || HISTERESIS;
    const tahan = Number(start.tahan) || TAHAN_FRAME;

    /* id tangan -> { slot, yakin } — "yakin" hitungan frame berturut-turut
     * tangan berada di sisi seberang slotnya. */
    const pegangan = new Map();

    function sisi(x) {
      return x < GARIS_TENGAH ? 0 : 1;
    }

    function buangTanganHilang(hands) {
      const aktif = new Set(hands.map(function (hand) { return hand.id; }));
      pegangan.forEach(function (_nilai, id) {
        if (!aktif.has(id)) pegangan.delete(id);
      });
    }

    function target(hand) {
      const x = Number(hand.wrist_x);
      const aman = Number.isFinite(x) ? x : GARIS_TENGAH;
      if (jumlah === 1) return 0;

      const lama = pegangan.get(hand.id);
      if (!lama || lama.slot >= jumlah) return sisi(aman);

      const seberang = sisi(aman) !== lama.slot;
      const cukupJauh = Math.abs(aman - GARIS_TENGAH) > histeresis;
      if (seberang && cukupJauh) lama.yakin += 1;
      else lama.yakin = 0;

      if (lama.yakin >= tahan) {
        lama.yakin = 0;
        return sisi(aman);
      }
      return lama.slot;
    }

    function assign(hands) {
      const daftar = Array.isArray(hands) ? hands : [];
      if (!daftar.length) {
        pegangan.clear();
        return [];
      }
      buangTanganHilang(daftar);

      const mau = daftar.map(function (hand) {
        return { id: hand.id, slot: target(hand), punya: pegangan.has(hand.id) };
      });

      /* Yang sudah pegang diutamakan, sisanya ikut urutan datangnya. */
      const antrean = mau.slice().sort(function (a, b) {
        if (a.punya !== b.punya) return a.punya ? -1 : 1;
        if (a.punya && b.punya) return a.slot - b.slot;
        return mau.indexOf(a) - mau.indexOf(b);
      });

      const terpakai = new Set();
      const hasil = new Map();
      antrean.forEach(function (item) {
        let slot = item.slot;
        if (slot >= jumlah || terpakai.has(slot)) {
          slot = bebasTerdekat(terpakai, item.slot);
        }
        hasil.set(item.id, slot);
        if (slot >= 0) terpakai.add(slot);
      });

      daftar.forEach(function (hand) {
        const slot = hasil.get(hand.id);
        const lama = pegangan.get(hand.id);
        if (lama) lama.slot = slot;
        else pegangan.set(hand.id, { slot: slot, yakin: 0 });
      });

      return daftar.map(function (hand) { return hasil.get(hand.id); });
    }

    function bebasTerdekat(terpakai, diinginkan) {
      for (let offset = 0; offset < jumlah; offset += 1) {
        const kandidat = (diinginkan + offset) % jumlah;
        if (!terpakai.has(kandidat)) return kandidat;
      }
      return -1;
    }

    return {
      assign: assign,
      slotOf: function (id) {
        const nilai = pegangan.get(id);
        return nilai ? nilai.slot : -1;
      },
      setJumlah: function (nilai) {
        const baru = Math.max(1, Number(nilai) || 1);
        if (baru === jumlah) return;
        jumlah = baru;
        pegangan.forEach(function (_nilai, id) { pegangan.delete(id); });
      },
      jumlah: function () { return jumlah; },
      reset: function () { pegangan.clear(); },
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = createSlots;
  if (typeof window !== "undefined") window.createSlots = createSlots;
})();
