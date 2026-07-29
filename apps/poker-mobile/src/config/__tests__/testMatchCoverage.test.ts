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

describe('jest testMatch covers every __tests__ directory under src/', () => {
  it('leaves no test directory silently unrun', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testMatch } = require('../../../jest.config.js') as { testMatch: string[] };

    const uncovered = testDirs(SRC)
      .map(dir => {
        // A representative file each glob would have to match, in POSIX form for minimatch.
        const probe = join(dir, 'probe.test.ts').replace(/\\/g, '/');
        return { rel: relative(SRC, dir).replace(/\\/g, '/'), probe };
      })
      .filter(({ probe }) => !testMatch.some(glob => minimatch(probe, glob)))
      .map(({ rel }) => rel);

    expect(uncovered).toEqual([]);
  });

  it('every glob accepts BOTH .ts and .tsx', () => {
    // A glob ending `*.test.ts` (no `?(x)`) silently drops JSX tests in that directory.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testMatch } = require('../../../jest.config.js') as { testMatch: string[] };
    const tsOnly = testMatch.filter(g => !g.endsWith('*.test.ts?(x)'));
    expect(tsOnly).toEqual([]);
  });
});
