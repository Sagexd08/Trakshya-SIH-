import sharp from "sharp";

const SIZES = [192, 512];

const svg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(size*0.18)}" fill="url(#g)"/>
  <g font-family="Inter,Segoe UI,Arial" font-weight="700" font-size="${Math.round(size*0.5)}" text-anchor="middle" dominant-baseline="central">
    <text x="${size/2}" y="${size/2}" fill="#ffffff">T</text>
  </g>
</svg>`;

async function run(){
  for (const s of SIZES) {
    const out = `public/icon-${s}.png`;
    const buf = Buffer.from(svg(s));
    await sharp(buf).png({ compressionLevel: 9 }).toFile(out);
    console.log(`Wrote ${out}`);
  }
}

run().catch((e)=>{ console.error(e); process.exit(1); });

