import { readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { minimatch } from 'minimatch';

/**
 * Every `__tests__` directory under `src/` must be matched by `jest.config.js` `testMatch`.
 *
 * `testMatch` is an explicit ALLOWLIST of directories. That is a deliberate choice (it keeps
 * heavyweight screen tests out of the default run), but it fails in the worst possible direction:
 * a test placed in an unlisted directory is **silently skipped, not failed**. It reports as
 * coverage while running zero assertions.
 *
 * This has now bitten twice in one slice — first on file EXTENSION (four globs lacked `?(x)`, so a
 * `.tsx` test vanished), then on DIRECTORY (`src/theme/__tests__` wasn't listed at all, so a
 * freshly-written suite ran nothing and reported "0 matches"). Both times the symptom was a green
 * board. This closes the class rather than the instance: add a `__tests__` directory anywhere
 * under `src/` and either it is covered or this goes red.
 */
const APP_ROOT = resolve(__dirname, '..', '..', '..');
const SRC = resolve(APP_ROOT, 'src');

/** Every directory named `__tests__` anywhere under src/. */
function testDirs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === '__tests__') out.push(full);
    else testDirs(full, out);
  }
  return out;
}

/** Every file that LOOKS like a test, by any common convention — not just `*.test.ts`. */
function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name) || /[-.]test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * `dot: true` is load-bearing. Without it minimatch's `**` refuses to cross a dot-segment, so this
 * suite reported EVERY directory as uncovered when run from `.claude/worktrees/agent-*` — which is
 * exactly where this repo runs its mutation critics. Jest's own matcher has no such restriction, so
 * the pin was contradicting the behaviour it claims to pin.
 */
const matchesAnyGlob = (file: string, globs: string[]): boolean =>
  globs.some(glob => minimatch(file.replace(/\\/g, '/'), glob, { dot: true }));

describe('jest testMatch covers every __tests__ directory under src/', () => {
  it('leaves no test directory silently unrun', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testMatch } = require('../../../jest.config.js') as { testMatch: string[] };

    const uncovered = testDirs(SRC)
      .map(dir => ({
        rel: relative(SRC, dir).replace(/\\/g, '/'),
        probe: join(dir, 'probe.test.ts'),
      }))
      .filter(({ probe }) => !matchesAnyGlob(probe, testMatch))
      .map(({ rel }) => rel);

    expect(uncovered).toEqual([]);
  });

  it('leaves no test FILE silently unrun, whatever it is named', () => {
    // The directory check alone does not close the class: a `.spec.ts` inside a fully-covered
    // `__tests__` directory is still skipped in silence. A mutation run dropped a deliberately
    // FAILING `rogue.spec.ts` into a covered directory and the board stayed green.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testMatch } = require('../../../jest.config.js') as { testMatch: string[] };

    const unrun = testFiles(SRC)
      .filter(file => !matchesAnyGlob(file, testMatch))
      .map(file => relative(SRC, file).replace(/\\/g, '/'));

    expect(unrun).toEqual([]);
  });

  it('every glob accepts BOTH .ts and .tsx', () => {
    // A glob ending `*.test.ts` (no `?(x)`) silently drops JSX tests in that directory.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testMatch } = require('../../../jest.config.js') as { testMatch: string[] };
    const tsOnly = testMatch.filter(g => !g.endsWith('*.test.ts?(x)'));
    expect(tsOnly).toEqual([]);
  });
});
