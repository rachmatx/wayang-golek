/* dialog.js — naskah panggung. Satu baris maksimal 70 karakter.
 * Baris gestur punya dua varian; baris suasana punya satu atau lebih. */
(function (root) {
  "use strict";

  const Dialog = {
    label: {
      klasik: "Klasik",
      arjuna: "Arjuna",
      gatotkaca: "Gatotkaca",
      cepot: "Cepot",
    },
    karakter: {
      klasik: {
        gestur: {
          telapak_terbuka: [
            "Tangan terbuka, panggung pun terbuka.",
            "Lengan ini terbuka untukmu.",
          ],
          kepalan: [
            "Sudah cukup. Kita diam sejenak.",
            "Tenang. Panggung masih milik kita.",
          ],
          telunjuk: [
            "Ke mana pun kau tunjuk, aku ikut.",
            "Arahkan, aku mengikuti.",
          ],
          dua_jari: [
            "Dua jari, satu langkah kecil.",
            "Dua jari, dua langkah.",
          ],
          jempol: [
            "Matur nuwun, dalang.",
            "Terima kasih, dalang.",
          ],
          ok: [
            "Dunia berputar. Kita hadapi lagi.",
            "Kita berbalik dengan tenang.",
          ],
        },
        suasana: {
          sambutan: ["Sugeng rawuh, dalang. Panggung siap."],
          sambutan2: ["Mari kita mulai."],
          bangun: ["Oh, kau kembali. Mari lanjut."],
          tidur: ["Aku istirahat dulu, dalang."],
          masuk: ["Aku mengambil panggung sebentar."],
          keluar: ["Panggung kuserahkan."],
          sambung: ["Kita lanjut, dalang."],
          idle: [
            "Sepi, ya…",
            "Dalang, aku masih di sini.",
            "Angin malam ini dingin.",
          ],
          half: ["Dalang… masih di sana?"],
        },
      },

      arjuna: {
        gestur: {
          telapak_terbuka: [
            "Lebar tanganmu, lebar pula langkahku.",
            "Angin menyentuh kedua tanganku.",
          ],
          kepalan: [
            "Keteguhan hati, bukan kekerasan.",
            "Diam pun bagian dari tari.",
          ],
          telunjuk: [
            "Arahmu adalah arahku.",
            "Jari itu seperti panah yang tenang.",
          ],
          dua_jari: [
            "Dua jari, sehalus gerak angsa.",
            "Gemulai, bukan lemah.",
          ],
          jempol: [
            "Terima kasih, dalang budiman.",
            "Budi baikmu kucatat.",
          ],
          ok: [
            "Berbalik arah pun tetap anggun.",
            "Sisi lain pun indah.",
          ],
        },
        suasana: {
          sambutan: ["Sugeng rawuh. Lengan ini siap menari."],
          sambutan2: ["Mari menari bersama."],
          bangun: ["Kau kembali. Panggung terasa hidup."],
          tidur: ["Selamat malam, dalang."],
          masuk: ["Izinkan aku tampil."],
          keluar: ["Aku undur diri dengan hormat."],
          sambung: ["Kita lanjut, dalang."],
          idle: [
            "Senja ini tenang…",
            "Dalang, jangan jauh-jauh.",
            "Dengarkan gamelan di kejauhan.",
          ],
          half: ["Dalang… masih di sana?"],
        },
      },

      gatotkaca: {
        gestur: {
          telapak_terbuka: [
            "Buka selebar-lebarnya! Aku siap!",
            "HAH! Tenagaku penuh!",
          ],
          kepalan: [
            "Kepalan? Kekuatanku menahan diri.",
            "Kepalan ini kutahan dulu.",
          ],
          telunjuk: [
            "Tunjuk saja! Aku terjang!",
            "Mana lawannya? Aku siap!",
          ],
          dua_jari: [
            "Dua jari! Siap perang!",
            "Dua jari pun cukup untuk menantang!",
          ],
          jempol: [
            "Bagus! Kau punya selera!",
            "Jempolmu kecil, semangatmu besar!",
          ],
          ok: [
            "Berbalik? Hah, lawan di mana?",
            "Berbalik! Siap hadapi apa pun!",
          ],
        },
        suasana: {
          sambutan: ["HAH! Panggung sudah siap, dalang!"],
          sambutan2: ["Ayo, jangan lama-lama!"],
          bangun: ["Akhirnya! Aku hampir bosan."],
          tidur: ["Aku tidur. Bangunkan kalau ada perang."],
          masuk: ["Panggung ini butuh otot!"],
          keluar: ["Aku pergi dulu. Panggil kalau perlu."],
          sambung: ["Kita lanjut, dalang."],
          idle: [
            "Ototku bergetar!",
            "Dalang, ada lawan?",
            "Aku belum berkeringat.",
          ],
          half: ["Dalang… masih di sana?"],
        },
      },

      cepot: {
        gestur: {
          telapak_terbuka: [
            "Wih, tangannya lebar. Mau pelukin aku, ya?",
            "Pelukannya jangan terlalu kuat, ya.",
          ],
          kepalan: [
            "Aku dikepal? Aku wayang, bukan sambel.",
            "Jangan dikepal terus, nanti aku gepeng.",
          ],
          telunjuk: [
            "Tunjuk terus. Nanti aku kesasar.",
            "Jangan tunjuk aku terus, aku malu.",
          ],
          dua_jari: [
            "Dua jari doang? Aku kira mau traktir.",
            "Dua jari? Aku kira dua ribu.",
          ],
          jempol: [
            "Nah, gitu dong! Matur nuwun.",
            "Iya, iya, aku memang hebat.",
          ],
          ok: [
            "Lho, kok malah mbalik? Malu-maluin.",
            "Muter-muter kayak gasing.",
          ],
        },
        suasana: {
          sambutan: ["Lho, dalang datang! Aku belum mandi."],
          sambutan2: ["Ayo mulai, aku udah nggak sabar."],
          bangun: ["Eh, dalang! Aku kira kau kabur."],
          tidur: ["Aku tidur dulu. Jangan diganggu, ya."],
          masuk: ["Aku datang, bawa becanda."],
          keluar: ["Aku pergi dulu. Jangan kangen."],
          sambung: ["Kita lanjut, dalang."],
          idle: [
            "Dalang, ada makanan?",
            "Aku bosan. Ajak aku ngobrol.",
            "Jangan tidur, nanti aku kesepian.",
          ],
          half: ["Dalang… masih di sana?"],
        },
      },
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Dialog;
  if (typeof window !== "undefined") window.Dialog = Dialog;
})(typeof globalThis !== "undefined" ? globalThis : this);
