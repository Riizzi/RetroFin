// Ícones do APK a partir de public/icon.svg. Uso: node scripts/android-icons.mjs
import sharp from 'sharp';
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'android/app/src/main/res';
const FUNDO = '#66696E';
const CREME = '#FAF7F2';
const svg = readFileSync('public/icon.svg');

const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
for (const [d, [legado, adapt]] of Object.entries(dens)) {
  const dir = join(RES, `mipmap-${d}`);
  const ic = await sharp(svg, { density: 384 }).resize(legado, legado).png().toBuffer();
  await sharp(ic).toFile(join(dir, 'ic_launcher.png'));
  const mascara = Buffer.from(`<svg width="${legado}" height="${legado}"><circle cx="${legado / 2}" cy="${legado / 2}" r="${legado / 2}"/></svg>`);
  await sharp(ic).composite([{ input: mascara, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // Frente do ícone adaptativo: o desenho ocupa a zona segura (66/108)
  const lado = Math.round(adapt * 0.78);
  const frente = await sharp(svg, { density: 384 }).resize(lado, lado).png().toBuffer();
  await sharp({ create: { width: adapt, height: adapt, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: frente, gravity: 'center' }])
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'));
}
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${FUNDO}</color>\n</resources>\n`);

const icone = await sharp(svg, { density: 384 }).resize(512, 512).png().toBuffer();
for (const dir of readdirSync(RES)) {
  if (!dir.startsWith('drawable')) continue;
  const f = join(RES, dir, 'splash.png');
  try { statSync(f); } catch { continue; }
  const { width, height } = await sharp(f).metadata();
  const ic = await sharp(icone).resize(Math.round(Math.min(width, height) * 0.22)).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: CREME } }).composite([{ input: ic, gravity: 'center' }]).png().toFile(f + '.tmp');
  await sharp(f + '.tmp').toFile(f);
  unlinkSync(f + '.tmp');
}
console.log('ok');
