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
import fs from 'fs';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ESLINT_BIN = path.join(APP_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const VIOLATION_FIXTURE = 'src/config/__fixtures__/hooksAfterEarlyReturn.tsx';

/**
 * `--print-config` resolves by path PATTERN, so a nonexistent path still returns a config and the
 * assertion silently stops covering anything. Verified by mutation. Assert the file is real.
 */
function existing(relPath: string): string {
  expect(fs.existsSync(path.join(APP_ROOT, relPath))).toBe(true);
  return relPath;
}

/** The fully-resolved rule table ESLint would apply to `relPath`. */
function resolvedRulesFor(relPath: string): Record<string, unknown[]> {
  const out = execFileSync(process.execPath, [ESLINT_BIN, '--print-config', existing(relPath)], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return (JSON.parse(out).rules ?? {}) as Record<string, unknown[]>;
}

/** Actually lints a file and returns its messages. `[]` when ESLint exits 0. */
function lintMessages(relPath: string, extraArgs: string[] = []): { ruleId: string | null }[] {
  const args = [ESLINT_BIN, ...extraArgs, '--format', 'json', existing(relPath)];
  let out: string;
  try {
    out = execFileSync(process.execPath, args, { cwd: APP_ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    // ESLint exits 1 when it reports errors; the JSON is still on stdout.
    out = (e as { stdout?: string }).stdout ?? '';
  }
  return JSON.parse(out).flatMap((f: { messages: { ruleId: string | null }[] }) => f.messages);
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

  it('actually REPORTS a rules-of-hooks violation, not merely lists the rule', () => {
    // The behavioural half. Asserting the config table cannot tell you a file is going unlinted —
    // which is exactly how this slice nearly shipped with App.tsx outside coverage, because a
    // duplicate `lint` key in package.json silently pointed CI at a command that walks only src/.
    const messages = lintMessages(VIOLATION_FIXTURE, ['--no-ignore']);
    const hookErrors = messages.filter(m => m.ruleId === 'react-hooks/rules-of-hooks');
    expect(hookErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('wires npm run lint to eslint — the command CI actually invokes', () => {
    // The regression this exists for: `npx expo lint` appended its own `"lint": "expo lint"` to
    // package.json beneath ours. JSON is last-key-wins, so `npm run lint` — the exact string in
    // ci.yml — silently became `expo lint`, which walks only src/app/components and left App.tsx
    // uncovered. JSON.parse also takes the last duplicate, so this assertion sees what npm sees.
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.lint).toMatch(/^eslint\s/);
  });

  it('lints the project ROOT, not just src/ — App.tsx must be covered', () => {
    // App.tsx holds nine hooks above an early return. It was the single file left uncovered when
    // `npm run lint` resolved to `expo lint` (DEFAULT_INPUTS = src/app/components).
    const out = execFileSync(
      process.execPath,
      [ESLINT_BIN, '.', '--format', 'json'],
      { cwd: APP_ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    );
    const linted: string[] = JSON.parse(out).map((f: { filePath: string }) => f.filePath);
    expect(linted.some(p => p.endsWith(`${path.sep}App.tsx`))).toBe(true);
  });

  it('covers plain .ts as well as .tsx', () => {
    // A config that silently covered only JSX would miss hooks living in plain-.ts modules
    // (src/hooks/*.ts) — exactly where custom hooks are defined.
    expect(severityOf(resolvedRulesFor('src/hooks/useReducedMotion.ts'), 'react-hooks/rules-of-hooks'))
      .toBe(2);
  });
});
