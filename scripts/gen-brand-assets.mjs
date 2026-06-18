/**
 * Generate every Gnaver brand asset from ONE source mark so the app icon,
 * splash, favicon, Android adaptive icon and the in-app logo are identical.
 *
 * The mark: a flat, geometric map pin (white) on the electric-blue brand
 * gradient — minimalist, modern, crisp at 24px and 1024px.
 *
 *   node scripts/gen-brand-assets.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = resolve(ROOT, 'assets/images');
mkdirSync(IMG, { recursive: true });

// Brand gradient (matches src/theme/tokens.ts → gradients.brand).
const G0 = '#2AA6FF';
const G1 = '#0A84FF';
const G2 = '#0060DF';

// The pin, authored in a 0..100 box. Outer teardrop + a punched circular hole
// (fill-rule evenodd makes the hole show whatever is behind it).
const PIN =
  'M50 86 C34 64 24 54 24 38 A26 26 0 1 1 76 38 C76 54 66 64 50 86 Z ' +
  'M40 38 A10 10 0 1 1 60 38 A10 10 0 1 1 40 38 Z';

/** A <path> for the pin placed at (tx,ty) scaled by s, filled `fill`. */
const pin = (tx, ty, s, fill) =>
  `<path transform="translate(${tx},${ty}) scale(${s})" fill="${fill}" fill-rule="evenodd" d="${PIN}"/>`;

const gradientDef = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${G0}"/>
      <stop offset="0.5" stop-color="${G1}"/>
      <stop offset="1" stop-color="${G2}"/>
    </linearGradient>
  </defs>`;

// Center a pin of scale `s` inside a `size` canvas. Pin box: x∈[24,76] (cx 50),
// y∈[12,86] (visual center ≈ 49).
const centered = (size, s, fill) =>
  pin(size / 2 - 50 * s, size / 2 - 49 * s, s, fill);

// ── Full-bleed app icon (iOS rounds the corners itself) ──────────────────────
const iconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${gradientDef}
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  ${centered(size, size / 116, '#FFFFFF')}
</svg>`;

// ── Rounded gradient tile (splash) ───────────────────────────────────────────
const tileSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${gradientDef}
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  ${centered(size, size / 116, '#FFFFFF')}
</svg>`;

// ── Bare glyph on transparent (in-app overlay; tint via fill) ─────────────────
const glyphSvg = (size, fill) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${centered(size, size / 108, fill)}
</svg>`;

// ── Android adaptive foreground / monochrome: smaller, in the 66% safe zone ───
const safeGlyphSvg = (size, fill) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${centered(size, size / 150, fill)}
</svg>`;

const bgSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${gradientDef}
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`;

const png = (svg, out, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(IMG, out));

await Promise.all([
  png(iconSvg(1024), 'icon.png', 1024), // iOS + universal app icon
  png(tileSvg(1024), 'splash-icon.png', 1024), // splash (white bg, rounded tile)
  png(iconSvg(256), 'favicon.png', 256), // web favicon
  png(glyphSvg(512, '#FFFFFF'), 'logo-mark.png', 512), // in-app white glyph
  png(safeGlyphSvg(1024, '#FFFFFF'), 'android-icon-foreground.png', 1024),
  png(bgSvg(1024), 'android-icon-background.png', 1024),
  png(safeGlyphSvg(1024, '#FFFFFF'), 'android-icon-monochrome.png', 1024),
]);

console.log('Brand assets regenerated from the unified pin mark.');
