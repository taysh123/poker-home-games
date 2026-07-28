/**
 * Ban `jest.mock(name, factory, { virtual: true })` on modules that actually exist.
 *
 * Root-caused 2026-07-27 (PR #57 CI red): a `virtual: true` mock of the real
 * 'expo-notifications' module poisoned worker-level module resolution — a LATER test file in
 * the SAME jest worker mocking the same module normally silently got the REAL module instead.
 * Local runs stayed green (different worker packing); CI's 2-core runner packed the files
 * together and failed. The bug class is order-dependent and invisible locally, so it gets a
 * grep ban in the house style (see dayKeyBan.test.ts).
 *
 * `virtual: true` is only legitimate for modules that DO NOT exist on disk; none of our tests
 * need that today. If one ever genuinely does, add it to the allowlist with a comment.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');
const ALLOWLIST: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe('jest.mock hygiene', () => {
  it('no test uses { virtual: true } on a real module (worker-level resolution poison)', () => {
    const offenders = walk(SRC)
      .filter(f => !f.endsWith('jestMockHygieneBan.test.ts')) // this file names the pattern
      .filter(f => !ALLOWLIST.some(a => f.replace(/\\/g, '/').endsWith(a)))
      .filter(f => /virtual\s*:\s*true/.test(fs.readFileSync(f, 'utf8')))
      .map(f => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
