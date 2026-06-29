import { sha256Hex, canonicalRowBody, contentHash } from '../hash';
import type { SchemaColumn } from '../types';

describe('sha256Hex (known-answer vectors)', () => {
  it('matches FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('The quick brown fox jumps over the lazy dog'))
      .toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });
  it('handles multi-byte UTF-8', () => {
    // 'aaaa...' (longer than one block) stays stable; non-ASCII produces 64 hex chars.
    expect(sha256Hex('a'.repeat(1000))).toHaveLength(64);
    expect(sha256Hex('₪ ♠ é 🂡')).toHaveLength(64);
  });
});

describe('canonicalRowBody / contentHash', () => {
  const schema: SchemaColumn[] = [
    { column: 'id', datatype: 'string' },
    { column: 'freq', datatype: 'number' },
    { column: 'note', datatype: 'string' },
  ];
  it('is order-independent over rows (sorted body)', () => {
    const a = canonicalRowBody([{ id: 'x', freq: 1, note: 'a' }, { id: 'y', freq: 2, note: 'b' }], schema);
    const b = canonicalRowBody([{ id: 'y', freq: 2, note: 'b' }, { id: 'x', freq: 1, note: 'a' }], schema);
    expect(a).toBe(b);
    expect(contentHash({ rows: [{ id: 'x', freq: 1, note: 'a' }], schema })).toHaveLength(64);
  });
  it('changes when a value changes', () => {
    const h1 = contentHash({ rows: [{ id: 'x', freq: 1, note: 'a' }], schema });
    const h2 = contentHash({ rows: [{ id: 'x', freq: 2, note: 'a' }], schema });
    expect(h1).not.toBe(h2);
  });
  it('treats null/undefined consistently and ignores non-schema keys', () => {
    const h1 = contentHash({ rows: [{ id: 'x', freq: null, note: undefined }], schema });
    const h2 = contentHash({ rows: [{ id: 'x', freq: null, note: undefined, extra: 'ignored' }], schema });
    expect(h1).toBe(h2);
  });
});
