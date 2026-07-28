/**
 * Q1.2 commit 1 (substrate) — generates assets/splash-icon.png from the master icon.
 *
 *   node scripts/makeSplashAsset.mjs
 *
 * WHY: the shipped splash-icon.png was a byte-identical 2.1MB copy of icon.png with NO alpha
 * channel, so its baked near-black canvas (#080808) rendered as a visibly wrong-coloured square
 * on the navy splash background (#0A111B) — the OS splash could never match the JS splash it
 * hands off to.
 *
 * WHAT THIS DOES (substrate only — no redesign): flood-fills the EXTRANEOUS canvas outside the
 * badge to transparent, so app.json's `splash.backgroundColor` shows through and the asset
 * follows the brand colour automatically. The badge's own dark interior is preserved: the gold
 * frame is a closed loop, so a fill seeded at the corners cannot reach inside it. Badge size and
 * artwork are untouched — proportion is a choreography decision, not a substrate fix.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../assets/icon.png');
const OUT = resolve(here, '../assets/splash-icon.png');

/** A pixel counts as extraneous canvas when it is near-black (the badge frame is gold, the
 *  interior artwork is coloured, so this only matches the surround + its antialiasing). */
const CANVAS_MAX = 28;

const png = PNG.sync.read(readFileSync(SRC));
const { width: w, height: h, data } = png;
const out = new PNG({ width: w, height: h });
data.copy(out.data);

const idx = (x, y) => (y * w + x) * 4;
const isCanvas = i => out.data[i] <= CANVAS_MAX && out.data[i + 1] <= CANVAS_MAX && out.data[i + 2] <= CANVAS_MAX;

// Flood fill (iterative, 4-connected) seeded from every corner.
const seen = new Uint8Array(w * h);
const stack = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
let cleared = 0;
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (seen[p]) continue;
  const i = idx(x, y);
  if (!isCanvas(i)) continue; // hit the gold frame — stop, never enters the badge
  seen[p] = 1;
  out.data[i + 3] = 0; // fully transparent; the navy behind shows through
  cleared++;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// Feather: any still-opaque pixel touching cleared canvas gets proportional alpha so the badge
// edge doesn't alias harshly against the navy.
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (seen[p]) continue;
    const i = idx(x, y);
    if (out.data[i + 3] !== 255) continue;
    const neighbours = [p - 1, p + 1, p - w, p + w].filter(n => seen[n]).length;
    if (neighbours > 0) out.data[i + 3] = Math.round(255 * (1 - neighbours / 6));
  }
}

// Zero the RGB of fully-transparent pixels. They still carried the old canvas noise, which
// defeats PNG filtering — flattening them makes the surround compress to almost nothing.
for (let i = 0; i < out.data.length; i += 4) {
  if (out.data[i + 3] === 0) { out.data[i] = 0; out.data[i + 1] = 0; out.data[i + 2] = 0; }
}

/** Box-downsample to the target edge (alpha-weighted so the feathered rim stays clean). A splash
 * badge is never drawn larger than the screen; 1024 is the platform-recommended master size and
 * keeps the asset a fraction of the 2.1MB icon copy it replaces. */
function downsample(src, target) {
  if (src.width <= target) return src;
  const f = src.width / target;
  const dst = new PNG({ width: target, height: target });
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * f), y0 = Math.floor(y * f);
      const x1 = Math.min(src.width, Math.floor((x + 1) * f)), y1 = Math.min(src.height, Math.floor((y + 1) * f));
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4;
          const al = src.data[i + 3] / 255;
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al;
          a += src.data[i + 3]; n++;
        }
      }
      const o = (y * target + x) * 4;
      const aw = a / n / 255;
      dst.data[o] = aw ? Math.round(r / n / aw) : 0;
      dst.data[o + 1] = aw ? Math.round(g / n / aw) : 0;
      dst.data[o + 2] = aw ? Math.round(b / n / aw) : 0;
      dst.data[o + 3] = Math.round(a / n);
    }
  }
  return dst;
}

const final = downsample(out, 1024);
const before = readFileSync(SRC).length;
writeFileSync(OUT, PNG.sync.write(final, { deflateLevel: 9 }));
const after = readFileSync(OUT).length;
console.log(`splash asset written: ${final.width}x${final.height} (from ${w}x${h})`);
console.log(`  transparent canvas pixels: ${cleared.toLocaleString()} (${((cleared / (w * h)) * 100).toFixed(1)}%)`);
console.log(`  size: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
if (cleared < w * h * 0.05) throw new Error('flood fill cleared implausibly little — check CANVAS_MAX / source art');
