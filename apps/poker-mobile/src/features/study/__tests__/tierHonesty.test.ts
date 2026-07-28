/**
 * Q1.1 WIRING pins for the tier-honest label (the Q0 lesson: pinning the pure function alone
 * let the wiring silently revert). Two guarantees:
 *   1. the study/trainer dataset is genuinely calibrated and labels as the approved wording;
 *   2. the retired dishonest phrasing can never come back by hand.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { CALIBRATED_DATASET } from '../data/calibratedRanges';
import { STARTER_DATASET } from '../data/starterRanges';
import { tierLabel } from '../logic/rangeConvert';
import { PROD_FLAGS } from '../../../config/features';

const SRC = resolve(__dirname, '../../..');

/** Judge CODE, not prose — the retired phrase is legitimately discussed in comments. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('tier honesty — the label follows the data', () => {
  it('the study dataset is calibrated and renders the approved wording', () => {
    expect(CALIBRATED_DATASET.verificationTier).toBe('calibrated');
    expect(tierLabel(CALIBRATED_DATASET)).toBe('Expert-calibrated range');
  });

  it('the starter pack stays illustrative and can NEVER render a calibrated/solver claim', () => {
    expect(STARTER_DATASET.verificationTier).toBe('illustrative');
    expect(tierLabel(STARTER_DATASET)).toBe('Training range');
    expect(tierLabel(STARTER_DATASET)).not.toMatch(/calibrated|solver|GTO/i);
  });

  it('SpotTrainer derives its strategy label from the dataset (no hardcoded tier claim)', () => {
    const src = readFileSync(join(SRC, 'features/study/ui/SpotTrainerScreen.tsx'), 'utf8');
    expect(src).toMatch(/strategyLabel\s*=\s*tierLabel\(dataset\)/);
    // …and actually RENDERS that label, not just computes it.
    expect(src).toMatch(/\{strategyLabel\}/);
  });

  it('StudyContext serves the calibrated dataset — reverting to the starter pack must fail here', () => {
    // The provider-delivered dataset is what the trainer labels; asserting the module alone let
    // a StudyContext revert stay green (fleet find C2 — the same class as Q0's unpinned wiring).
    const src = readFileSync(join(SRC, 'features/study/state/StudyContext.tsx'), 'utf8');
    const code = stripComments(src);
    expect(code).toMatch(/import\s*\{\s*CALIBRATED_DATASET\s*\}/);
    expect(code.match(/dataset:\s*CALIBRATED_DATASET/g) ?? []).toHaveLength(2); // default + provider
    expect(code).not.toMatch(/STARTER_DATASET/);
  });

  it('"GTO play" is retired repo-wide — solver-grade wording may never label calibrated data', () => {
    const offenders = walk(SRC)
      .filter(f => /GTO play/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(f => relative(SRC, f).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('solver-grade vocabulary never appears in study UI copy', () => {
    // Widened after the fleet showed a narrow "GTO play" grep let an unguarded
    // "import solver packs anytime" claim ship in the very PR retiring apologetic copy.
    const BANNED = /\bGTO\b|solver-(verified|approved|perfect)|optimal play/i;
    const offenders = walk(join(SRC, 'features/study/ui'))
      .filter(f => BANNED.test(stripComments(readFileSync(f, 'utf8'))))
      .map(f => relative(SRC, f).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('study UI never advertises a capability whose flag is OFF in production', () => {
    // The failure mode of the removed `free_ai` reminder — and of this PR's first draft
    // ("import solver packs anytime" while PROD_FLAGS.solver is false).
    //
    // A file-level "is it inside a flag gate?" check does NOT work: StudyScreen already gates a
    // solver ENTRY CARD, so a file-level exemption would wave through prose anywhere in the same
    // file — verified by mutation, the blocker copy slipped straight past that version. So the
    // claim is banned outright in study UI; if a gated claim is ever genuinely wanted, add it to
    // ALLOWED here deliberately (the dayKeyBan pattern).
    const claims: { flag: 'solver' | 'coach'; pattern: RegExp }[] = [
      { flag: 'solver', pattern: /import (a )?solver pack/i },
      { flag: 'coach', pattern: /ask the (AI )?coach/i },
    ];
    const ALLOWED = new Set<string>();
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'features/study/ui'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const { flag, pattern } of claims) {
        if (pattern.test(code) && !PROD_FLAGS[flag]) offenders.push(`${rel} claims ${flag}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
