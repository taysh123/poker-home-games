/**
 * ESLint-config pin.
 *
 * `eslint.config.js` exists because a real `react-hooks/rules-of-hooks` violation — hooks below a
 * conditional return, which crashes with "Rendered fewer hooks than expected" — passed
 * `tsc --noEmit`, 1,051 jest tests and a full web export in one session.
 *
 * A lint rule you never assert is a lint rule that can be silently downgraded: by a dependency
 * bump to `eslint-config-expo`, by someone adding an override, or by the rule disappearing from
 * the shared preset. CI stays green, the config file still LOOKS like protection, and the bug
 * class is invisible again. So this asserts the RESOLVED severity for real source files — the same
 * discipline as pinning rate-limit constants to literals rather than to symbols.
 *
 * It shells out to ESLint's own resolver rather than importing its API: ESLint 9 loads flat config
 * via dynamic `import()`, which jest's VM cannot do without --experimental-vm-modules. Going
 * through the CLI resolves exactly what a developer or CI run would get.
 */
import { execFileSync } from 'child_process';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ESLINT_BIN = path.join(APP_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

/** The fully-resolved rule table ESLint would apply to `relPath`. */
function resolvedRulesFor(relPath: string): Record<string, unknown[]> {
  const out = execFileSync(process.execPath, [ESLINT_BIN, '--print-config', relPath], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return (JSON.parse(out).rules ?? {}) as Record<string, unknown[]>;
}

const severityOf = (rules: Record<string, unknown[]>, rule: string): number | undefined =>
  rules[rule]?.[0] as number | undefined;

describe('eslint.config.js — guarantees are explicit, not inherited', () => {
  // Resolving config spawns ESLint; comfortably slower than a pure unit test.
  jest.setTimeout(60_000);

  it('runs react-hooks/rules-of-hooks as an ERROR on app source', () => {
    expect(severityOf(resolvedRulesFor('src/screens/HomeScreen.tsx'), 'react-hooks/rules-of-hooks'))
      .toBe(2);
  });

  it('keeps react-hooks/exhaustive-deps enabled at least as a warning', () => {
    // Ratchet target: stale closures are a bug class this repo HAS shipped. It may be raised to
    // error in its own slice; it must never reach 0 (off).
    const severity = severityOf(resolvedRulesFor('src/screens/HomeScreen.tsx'), 'react-hooks/exhaustive-deps');
    expect(typeof severity).toBe('number');
    expect(severity as number).toBeGreaterThanOrEqual(1);
  });

  it('covers plain .ts as well as .tsx', () => {
    // A config that silently covered only JSX would miss hooks living in plain-.ts modules
    // (src/hooks/*.ts) — exactly where custom hooks are defined.
    expect(severityOf(resolvedRulesFor('src/hooks/useReducedMotion.ts'), 'react-hooks/rules-of-hooks'))
      .toBe(2);
  });
});
