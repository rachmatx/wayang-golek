# Latar panggung v0.3

Dibuat 18 November 2026 (Asia/Jakarta) untuk panggung wayang kulit interaktif.
Ilustrasi ini adalah **skenografi digital interpretatif**. Bentuk bingkai, tanaman,
gunung, dan pencahayaannya tidak diklaim sebagai dokumentasi pendopo tertentu,
rekonstruksi kelir bersejarah, atau bentuk pakeliran yang sudah divalidasi praktisi
Jawa Timuran. Cakupan budaya aplikasi tetap mengikuti
[catatan riset](../../../docs/research/2026-11-18-wayang-kulit-jawa-timuran.md).

## Berkas

| Aset | Pemakaian |
| --- | --- |
| `stage-pendopo.webp` | Pendopo Senja: kayu gelap, cahaya amber, lanskap hijau berlapis |
| `stage-rimba.webp` | Rimba Malam: kelir teal/indigo, cahaya emas rendah, hutan dan gunung berkabut |
| `vibe_images/stage-v03/stage-pendopo-master.png` | Master PNG asli dari generator, di akar repo |
| `vibe_images/stage-v03/stage-rimba-master.png` | Master PNG asli dari generator, di akar repo |

Kedua output asli berukuran **1672 × 941 px**, mendekati 16:9.
Mode produksi: **built-in image generation**, satu panggilan per aset.
Master PNG disalin tanpa pengeditan pixel. Runtime WebP di-encode memakai
ImageMagick quality 90, tanpa crop, resize, atau penambahan ornamen.
Keduanya aset baru; berkas v0.2 tidak ditimpa.

## Rujukan proyek serupa dan keputusan visual

[Lamplight Shadow Theater](https://dogum.github.io/artifact-shelf/a/lamplight-shadow-theater/),
demo dan uraian teknis oleh pembuatnya, diakses 18 November 2026. Uraiannya
menjelaskan layar kertas berlapis, cahaya lampu dengan falloff, dan bayangan yang
berubah sesuai kedalaman. Rujukan dipakai untuk prinsip suasana teater dan
keterbacaan, bukan untuk menyalin kode, gambar, motif, atau asetnya.

Prinsip yang diterapkan:

- Pusat terang dan tenang agar figur kulit merah/cokelat/emas tetap terbaca.
- Tekstur kain dan sebaran cahaya membuat pusat terasa sebagai kelir, bukan bidang warna polos.
- Kedalaman atmosfer dari pegunungan jauh, vegetasi menengah, dan tepian gelap dekat.
- Ukiran dan tanaman dibatasi di sisi serta bagian atas/bawah, sehingga tidak memenuhi ruang gerak wayang.
- Dua suasana memberi pilihan hangat dan malam tanpa mengubah identitas karakter.

Motif dekoratif dan lanskap merupakan keputusan artistik original hasil generasi,
bukan klaim motif eksklusif atau simbolisme adat tertentu.

## Pemeriksaan

Kedua hasil dilihat pada resolusi asli dan setelah encoding WebP. Tidak ditemukan
teks, watermark, UI, manusia, atau figur wayang di latar. Pusat lapang,
siluet lanskap rendah, dan bingkai sisi tetap terjaga. Tidak ada jaminan hasil
akan terlihat identik pada semua rasio panggung; integrasi sebaiknya memakai
posisi tengah dan memperhitungkan crop pada viewport sempit.

## Prompt final: Pendopo Senja

```text
Use case: stylized-concept. Asset type: final background painting for an interactive Indonesian wayang kulit puppet stage; wide landscape 16:9, high resolution 2560x1440 composition. Title for internal reference only: Pendopo Senja. Create a premium cinematic theatrical diorama inspired by the mood of an East Javanese pendopo and illuminated kelir. Frontal symmetrical stage view, no perspective floor grid. Restrained very dark carved teak proscenium only on outermost left and right 8% and narrow top 9%; aged brass accents, elegant finely carved leaf geometry rather than dense ornate clutter. The middle seventy percent is a broad luminous quiet puppet performance area, creamy parchment-gold with subtle cloth grain and warm uneven lamplight falling softly from above, delicate atmospheric mist rather than flat blank beige. At lower corners and peripheral edges, layered dark tropical leaves, near-black ferns, graceful trees and muted blue-green mountain silhouettes recede into smoky sunset atmosphere; landscape shapes stay mainly below bottom 18% or outer edges, while a very faint distant mountain gradient can cross the middle below waist height. Rich deep forest teal shadows, chestnut teak, luminous warm ivory, controlled muted antique gold. Painterly artisan theatre set, tactile materials, convincing soft depth, restrained movie production art, beautifully balanced light-dark shapes. Center light is broad rather than spotlight circle, soft luminous cloth not a desert sky. Designed for detailed red, brown and gold flat leather puppets to read clearly in front. No people, no puppets, no figures, no wayang silhouettes, no gunungan, no furniture, no gamelan, no text or letters or numbers, no logos, no watermark, no UI, no border mat. This is an original interpretative digital scenography, not a documentary historical reconstruction. Fill whole image edge to edge.
```

## Prompt final: Rimba Malam

```text
Use case: stylized-concept. Asset type: final background painting for an interactive Indonesian wayang kulit puppet stage, wide landscape 16:9 high resolution. Internal title Rimba Malam, do not write title in artwork. Create a premium theatrical diorama inspired by a kelir performance and tropical Javanese forest at dusk. Frontal stage composition with restrained carved dark teak columns on only the outermost 7% each side, and a very narrow dark top beam with low-gloss antique brass leaf carving. The central seventy percent must be broad, unobstructed and quiet for animated red-brown-and-gold leather puppets. It is luminous smoky pale teal and muted blue-grey, softly moonlit in the upper center with a gentle warm amber lamp glow diffused across the lower center, like a theatre cloth lit from behind. There is still beautiful visible atmospheric detail: very faint mountains in blue-grey haze, mist, subtle irregular linen grain; no flat monotone blankness. Rich jungle canopy and big leaves cling to the peripheral side edges; layered near-black foreground ferns and low forest silhouettes occupy bottom 14%; distant mountains very low in frame. Center remains medium-light desaturated blue teal rather than black so puppets read clearly. Elegant limited palette: deep indigo, jade teal, smoky silver-blue, warm antique gold. Painterly production design, finely detailed carved wood, tactile cloth, cinematic soft atmospheric depth, serene mysterious night mood. Keep the center bright enough and free of objects. No visible moon disc, no stars, no people, no animals, no puppets, no wayang silhouettes, no gunungan, no furniture, no instruments, no text, no letters, no numbers, no logos, no watermark, no UI, no border mat. Original interpretative scenography, no claim of historical reconstruction. Fill whole frame edge to edge.
```

