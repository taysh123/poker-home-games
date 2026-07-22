/**
 * Daily quiz rotation — PURE, testable. One stable seeded shuffle of the pool (day-independent)
 * plus a window that advances by `count` per local day: fresh questions daily, identical within a
 * day, and every question appears before any repeats (full cycle = pool/count days). The caller
 * passes dayKey (localDayKey()) — no Date.now here.
 *
 * The shuffle seed derives from the pool size only, so the permutation is stable across app
 * restarts and identical for everyone on a given content version; a content update that changes
 * the pool size re-deals the order (accepted — cycles restart on content updates).
 */

/** FNV-1a 32-bit string hash. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG, good enough for shuffling content. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MS_PER_DAY = 86400000;
const dayNumber = (dayKey: string): number =>
  Math.floor(new Date(`${dayKey}T00:00:00.000Z`).getTime() / MS_PER_DAY);

/** Select `count` items for `dayKey` from a stable shuffled cycle over `items`. Non-mutating. */
export function dailyRotation<T>(items: T[], dayKey: string, count: number): T[] {
  if (items.length === 0 || count <= 0) return [];

  const order = [...items];
  const rng = mulberry32(hashStr(`tpoker.rotation.v1:${order.length}`));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const take = Math.min(count, order.length);
  const start = ((dayNumber(dayKey) * count) % order.length + order.length) % order.length;
  const out: T[] = [];
  for (let k = 0; k < take; k++) out.push(order[(start + k) % order.length]);
  return out;
}
