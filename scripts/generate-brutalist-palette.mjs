#!/usr/bin/env node
// Generates src/styles/brutalist-palette.css.
//
// The app was designed dark-first, so most components hard-code dark-theme
// Tailwind colours (text-white, bg-black/40, border-white/10, text-[#F5C453] ...).
// The Brutalist theme is light, so every colour utility used in src/ is remapped
// to a light neo-brutalist equivalent, scoped to [data-ui-style='brutalist'].
// Re-run after adding new colour utilities:  npm run theme:brutalist
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(SRC, 'styles', 'brutalist-palette.css');

const INK = '#0b0b0b';
const INK_2 = '#333333';
const INK_3 = '#595959';
const SURFACE = '#ffffff';
const INSET = '#fbf4e6';
const TRACK = '#e4dccb';

// Tailwind palette, read from the installed tailwindcss theme (oklch values)
function oklchToRgb(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map(v => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, x)) * 255);
  });
}

const PALETTE = {};
const themeCss = readFileSync(join(ROOT, 'node_modules', 'tailwindcss', 'theme.css'), 'utf8');
for (const m of themeCss.matchAll(/--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)) {
  PALETTE[`${m[1]}-${m[2]}`] = oklchToRgb(Number(m[3]) / 100, Number(m[4]), Number(m[5]));
}
PALETTE.white = [255, 255, 255];
PALETTE.black = [0, 0, 0];

// The app's brand colours get fixed neo-brutalist counterparts instead of
// computed ones: olive and gold become the yellow primary, Kurdish red the red.
const BRAND = {
  '52673a': { bg: '#ffd23f', text: '#3d5a1c' },
  'f5c453': { bg: '#ffd23f', text: '#8a5a00' },
  'f59e0b': { bg: '#ffd23f', text: '#8a5a00' },
  '8c2425': { bg: '#ff5a5a', text: '#b3121b' },
};

const NEUTRAL_FAMILIES = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone', 'white', 'black']);

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map(ch => ch + ch).join('');
  const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { rgb, alpha };
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l, chroma: 0 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l, chroma: d };
}

// Hue rounded to 5 degrees so near-identical colours share one rule
const hsl = (h, s, l) => `hsl(${(Math.round(h / 5) * 5) % 360} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function parseColor(colorToken, opacityToken) {
  let rgb, alpha = 1, neutral = false;
  // Gold accent variables are yellow under Brutalist: readable as fills only
  if (colorToken.startsWith('[var(')) colorToken = '[#f5c453]';
  if (colorToken.startsWith('[')) {
    const parsed = hexToRgb(colorToken.slice(1, -1));
    rgb = parsed.rgb; alpha = parsed.alpha;
  } else {
    rgb = PALETTE[colorToken];
    if (!rgb) return null;
    neutral = NEUTRAL_FAMILIES.has(colorToken.split('-')[0]);
  }
  if (opacityToken) {
    const raw = opacityToken.replace(/[[\]%]/g, '');
    const n = Number(raw);
    alpha *= opacityToken.includes('.') && n <= 1 ? n : n / 100;
  }
  const info = rgbToHsl(rgb);
  const brand = colorToken.startsWith('[') ? BRAND[colorToken.slice(2, -1).toLowerCase().slice(0, 6)] : undefined;
  if (brand) return { ...info, alpha, neutral: false, brand };
  // Low-chroma colours (beiges, greys) and very dark tints behave like neutrals
  if (info.chroma < 0.25 || info.l < 0.2) neutral = true;
  return { ...info, alpha, neutral };
}

// Dark, readable version of a hue for text on a light background
function readableHue(h, s) {
  const l = h >= 75 && h < 200 ? 0.28 : h >= 20 && h < 75 ? 0.32 : 0.42;
  return hsl(h, clamp(s, 0.65, 0.9), l);
}

function mapText(c) {
  if (c.brand) return c.brand.text;
  if (c.neutral) {
    if (c.l < 0.35) return INK;
    if (c.l < 0.55) return INK_3;
    if (c.alpha >= 0.85) return INK;
    if (c.alpha >= 0.55) return INK_2;
    return INK_3;
  }
  return readableHue(c.h, c.s);
}

function mapBackground(c) {
  if (c.brand) return c.alpha <= 0.4 ? '#fff0b8' : c.brand.bg;
  if (c.neutral) {
    if (c.l > 0.6) return c.alpha >= 0.6 ? SURFACE : INSET;
    if (c.l > 0.35) return TRACK;
    return c.alpha >= 0.7 ? SURFACE : INSET;
  }
  if (c.alpha <= 0.4) return hsl(c.h, 0.9, c.h >= 40 && c.h < 70 ? 0.84 : 0.88);
  return hsl(c.h, clamp(c.s, 0.75, 0.95), c.h >= 40 && c.h < 70 ? 0.58 : 0.62);
}

function mapBorder(c) {
  if (c.neutral || c.alpha < 0.5 || (c.h >= 30 && c.h < 100)) return INK;
  return hsl(c.h, 0.85, 0.36);
}

const VARIANTS = {
  hover: { pseudo: ':hover' },
  focus: { pseudo: ':focus' },
  'focus-visible': { pseudo: ':focus-visible' },
  'focus-within': { pseudo: ':focus-within' },
  active: { pseudo: ':active' },
  disabled: { pseudo: ':disabled' },
  first: { pseudo: ':first-child' },
  last: { pseudo: ':last-child' },
  odd: { pseudo: ':nth-child(odd)' },
  even: { pseudo: ':nth-child(even)' },
  placeholder: { pseudo: '::placeholder' },
  'group-hover': { ancestor: '.group:hover ' },
  sm: { media: 640 }, md: { media: 768 }, lg: { media: 1024 }, xl: { media: 1280 }, '2xl': { media: 1536 },
};

const COLOR = String.raw`(white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)|\[#[0-9a-fA-F]{3,8}\]|\[var\(--(?:primary-accent|primary-accent-hover|accent-gold|accent-gold-soft)\)\])`;
const TOKEN = new RegExp(
  String.raw`(?<![\w:\-\[\]/])((?:[a-z0-9-]+:)*)(text|bg|border(?:-[trblxy])?|ring|divide|outline|from|fill|stroke|placeholder)-${COLOR}(?:/(\d{1,3}|\[[\d.]+%?\]))?(?![\w\-/\[])`,
  'g'
);

function collectFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectFiles(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const tokens = new Set();
for (const file of collectFiles(SRC)) {
  for (const m of readFileSync(file, 'utf8').matchAll(TOKEN)) tokens.add(m[0]);
}

const SCOPE = "[data-ui-style='brutalist']";
// Boards keep their own colours; data-nb-keep opts any element out
const NOT_KEPT = ':not(:where(.board-3d-frame *, [data-nb-keep], [data-nb-keep] *))';
const PROP_ORDER = ['from', 'bg', 'text', 'fill', 'stroke', 'placeholder', 'border', 'ring', 'outline', 'divide'];

const rules = new Map(); // key: media|order|declaration -> selectors
let skipped = 0;

for (const token of [...tokens].sort()) {
  TOKEN.lastIndex = 0;
  const m = TOKEN.exec(token);
  if (!m) continue;
  const [, variantStr, prop, colorToken, opacity] = m;
  const color = parseColor(colorToken, opacity);
  if (!color) { skipped++; continue; }

  let pseudo = '', ancestor = '', media = 0, ok = true;
  for (const v of variantStr.split(':').filter(Boolean)) {
    const def = VARIANTS[v];
    if (!def) { ok = false; break; }
    if (def.pseudo) pseudo += def.pseudo;
    if (def.ancestor) ancestor += def.ancestor;
    if (def.media) media = Math.max(media, def.media);
  }
  if (!ok) { skipped++; continue; }

  const base = prop.startsWith('border') ? 'border' : prop;
  let decl;
  switch (base) {
    case 'text': decl = `color: ${mapText(color)}`; break;
    case 'fill': decl = `fill: ${mapText(color)}`; break;
    case 'stroke': decl = `stroke: ${mapText(color)}`; break;
    case 'placeholder': decl = `color: ${mapText(color)}`; pseudo += '::placeholder'; break;
    case 'bg': case 'from': decl = `background-color: ${mapBackground(color)}`; break;
    case 'border': case 'divide': decl = `border-color: ${mapBorder(color)}`; break;
    case 'ring': decl = `--tw-ring-color: ${mapBorder(color)}`; break;
    case 'outline': decl = `outline-color: ${mapBorder(color)}`; break;
  }

  const escaped = token.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Variant rules come after base rules so they win on equal specificity
  const order = PROP_ORDER.indexOf(base) + (pseudo || ancestor ? 100 : 0);
  const key = [media, String(order).padStart(3, '0'), ancestor, pseudo, base === 'divide' ? ' > :not(:last-child)' : '', decl].join('|');
  if (!rules.has(key)) rules.set(key, []);
  rules.get(key).push(`[class~="${escaped}"]`);
}

const byMedia = new Map();
for (const key of [...rules.keys()].sort()) {
  const [media, , ancestor, pseudo, child, decl] = key.split('|');
  if (!byMedia.has(media)) byMedia.set(media, []);
  const list = rules.get(key).join(',\n  ');
  byMedia.get(media).push(`${SCOPE} ${ancestor}:is(\n  ${list}\n)${NOT_KEPT}${pseudo}${child} {\n  ${decl};\n}`);
}

let css = `/* GENERATED by scripts/generate-brutalist-palette.mjs. Do not edit by hand.
 * Remaps the hard-coded dark-theme colour utilities used in src/ to the light
 * neo-brutalist palette while the Brutalist theme is active.
 * ${tokens.size} utilities scanned, ${skipped} skipped (unsupported variants).
 */\n\n`;
for (const media of [...byMedia.keys()].sort((a, b) => Number(a) - Number(b))) {
  const block = byMedia.get(media).join('\n\n');
  css += media === '0' ? `${block}\n\n` : `@media (min-width: ${media}px) {\n${block.replace(/^/gm, '  ')}\n}\n\n`;
}
writeFileSync(OUT, css.trimEnd() + '\n');
console.log(`wrote ${OUT}: ${tokens.size} utilities, ${rules.size} rules, ${skipped} skipped`);
