/**
 * One-off / CI: writes branded solid-color PNGs for PWA (matches globals .btn-primary #166534).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');

const BRAND = '#166534';

async function solidPng(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BRAND,
    },
  })
    .png()
    .toBuffer();
}

await mkdir(outDir, { recursive: true });
const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, px] of sizes) {
  const buf = await solidPng(px);
  await writeFile(join(outDir, name), buf);
}
console.log('Wrote', sizes.map(([n]) => join('public/icons', n)).join(', '));
