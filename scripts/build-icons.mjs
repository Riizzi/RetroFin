import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Color palette from user screenshot (Samsung OneUI Dark/Monochrome Theme)
const BG_GREY = '#66696E';
const FG_BLACK = '#0D0E10';

// 1. Standard Squircle App Icon (for any purpose, apple-touch, and favicon)
const svgStandard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Dark grey rounded squircle border/background -->
  <rect width="512" height="512" rx="136" fill="${BG_GREY}" />

  <!-- Standard Money Symbol: Banknote with Cifrão ($) in solid black -->
  <g transform="translate(0, 0)">
    <!-- Outer Banknote Body -->
    <rect x="96" y="166" width="320" height="180" rx="28" fill="${FG_BLACK}" />

    <!-- Inner Margin Frame Line (Knockout in Grey) -->
    <rect x="114" y="184" width="284" height="144" rx="18" fill="none" stroke="${BG_GREY}" stroke-width="6" />

    <!-- Side Currency Accents (Knockout in Grey) -->
    <circle cx="152" cy="256" r="16" fill="${BG_GREY}" />
    <circle cx="360" cy="256" r="16" fill="${BG_GREY}" />

    <!-- Center Currency Oval Badge (Knockout in Grey) -->
    <ellipse cx="256" cy="256" rx="52" ry="46" fill="${BG_GREY}" />

    <!-- Center Standard Currency ($) Sign in Bold Solid Black -->
    <path d="M 256 220 V 292 M 250 220 V 292 M 240 236 C 240 226 250 226 256 226 C 265 226 273 230 273 241 C 273 252 263 255 253 257 C 243 259 237 263 237 274 C 237 285 246 288 256 288 C 266 288 274 284 274 274" 
          fill="none" stroke="${FG_BLACK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

// 2. Maskable Icon for Android Adaptive Icons (Full bleed background, icon safely within 65% center safe-zone)
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Full bleed grey background for Android system adaptive masking -->
  <rect width="512" height="512" fill="${BG_GREY}" />

  <!-- Standard Money Symbol in Center Safe Area (Scale down slightly to avoid circular/teardrop cropping) -->
  <g transform="translate(256, 256) scale(0.85) translate(-256, -256)">
    <!-- Outer Banknote Body -->
    <rect x="96" y="166" width="320" height="180" rx="28" fill="${FG_BLACK}" />

    <!-- Inner Margin Frame Line (Knockout in Grey) -->
    <rect x="114" y="184" width="284" height="144" rx="18" fill="none" stroke="${BG_GREY}" stroke-width="6" />

    <!-- Side Currency Accents -->
    <circle cx="152" cy="256" r="16" fill="${BG_GREY}" />
    <circle cx="360" cy="256" r="16" fill="${BG_GREY}" />

    <!-- Center Currency Oval Badge -->
    <ellipse cx="256" cy="256" rx="52" ry="46" fill="${BG_GREY}" />

    <!-- Center Standard Currency ($) Sign -->
    <path d="M 256 220 V 292 M 250 220 V 292 M 240 236 C 240 226 250 226 256 226 C 265 226 273 230 273 241 C 273 252 263 255 253 257 C 243 259 237 263 237 274 C 237 285 246 288 256 288 C 266 288 274 284 274 274" 
          fill="none" stroke="${FG_BLACK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

async function build() {
  const publicDir = path.resolve('public');

  // Save icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgStandard, 'utf8');
  console.log('Saved public/icon.svg');

  // 192x192 PNG
  await sharp(Buffer.from(svgStandard))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated public/pwa-192x192.png');

  // 512x512 PNG
  await sharp(Buffer.from(svgStandard))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated public/pwa-512x512.png');

  // 512x512 Maskable PNG
  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated public/pwa-maskable-512x512.png');

  // Apple Touch Icon (180x180)
  await sharp(Buffer.from(svgStandard))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png');

  // Favicon (64x64)
  await sharp(Buffer.from(svgStandard))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated public/favicon.png');

  console.log('All icons built successfully!');
}

build().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
