/**
 * Content hashing for solver packs. Stable canonical JSON (recursively sorted keys, undefined dropped) →
 * 32-bit FNV-1a hex. This is an INTEGRITY checksum (detects corruption/tampering in transit/storage), NOT a
 * cryptographic signature. Pure + deterministic (key-order-independent) so validation + tests are reproducible.
 * `hashString` can be swapped for a stronger digest (e.g. SHA-256 via expo-crypto) later without changing callers.
 */
import type { SolverPack } from './types';

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      if (src[key] !== undefined) out[key] = sortDeep(src[key]);
    }
    return out;
  }
  return value;
}

/** 32-bit FNV-1a over the string's char codes → 8-char hex (pure, BigInt-free for max RN/web compat). */
export function hashString(s: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Canonical content hash of a pack: manifest WITHOUT contentHash + ranges + nodes. */
export function computeContentHash(pack: SolverPack): string {
  const m = pack.manifest as unknown as Record<string, unknown>;
  const manifestSansHash: Record<string, unknown> = {};
  for (const k of Object.keys(m)) {
    if (k !== 'contentHash') manifestSansHash[k] = m[k];
  }
  return hashString(canonicalize({ manifest: manifestSansHash, ranges: pack.ranges, nodes: pack.nodes ?? [] }));
}
