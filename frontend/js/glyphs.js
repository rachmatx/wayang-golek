/* glyphs.js — glif tangan inline untuk panduan gestur.
 *
 * Semua gambar cuma stroke 24x24 ikut warna teks, jadi tidak perlu aset
 * eksternal dan tetap terbaca di layar proyektor.
 */
(function () {
  "use strict";

  const TELAPAK = "M7 12.5h10v4.4a4.6 4.6 0 0 1-4.6 4.6h-.8A4.6 4.6 0 0 1 7 16.9z";

  /* Tiap entri adalah daftar `d` — jangan campur markup mentah, path tanpa
     pembungkus <path> tidak dirender SVG. */
  const GLIF = {
    telapak_terbuka: [
      "M7 15 4 12.4",
      "M9.2 12.5V5.4", "M11.7 12.5V3.9", "M14.2 12.5V4.4", "M16.6 12.5V6.1",
      TELAPAK,
    ],

    kepalan: [
      "M5.4 13.6a2.4 2.4 0 0 1 2.4-2.4h8.4a2.4 2.4 0 0 1 2.4 2.4v3a4.6 4.6 0 0 1-4.6 4.6H10a4.6 4.6 0 0 1-4.6-4.6z",
      "M9.4 11.6v2.9M12 11.6v2.9M14.6 11.6v2.9",
      "M6.6 16.6h4",
    ],

    telunjuk: [
      "M7.2 15 4.4 12.8",
      "M11.6 12.5V3.6",
      "M15 12.5v-2.2", "M17.2 12.5v-1.4",
      TELAPAK,
    ],

    dua_jari: [
      "M7.2 15 4.4 12.8",
      "M10.4 12.5V4.2", "M13.6 12.5V4.8",
      "M16.6 12.5v-1.8",
      TELAPAK,
    ],

    jempol: [
      "M9.6 12.4V6.6a1.9 1.9 0 0 1 3.8 0v5.8",
      "M14.6 12.5h2.6a2 2 0 0 1 2 2v2.6a4.4 4.4 0 0 1-4.4 4.4H9.4A2.4 2.4 0 0 1 7 17.1v-2.6a2 2 0 0 1 2-2.1z",
    ],

    ok: [
      "M9.4 6.6a3 3 0 1 1 0 6 3 3 0 1 1 0-6",
      "M14.4 12.5V5.2", "M16.8 12.5V6.4", "M18.6 12.5V8.6",
      TELAPAK,
    ],
  };

  function tangan(gesture) {
    const daftar = GLIF[gesture];
    if (!daftar) return "";
    const isi = daftar.map(function (d) { return '<path d="' + d + '" />'; }).join("");
    return (
      '<svg class="panduan-glif" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      isi +
      "</svg>"
    );
  }

  window.Glif = { tangan: tangan };
})();
