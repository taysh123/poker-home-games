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
  });

  it('"GTO play" is retired repo-wide — solver-grade wording may never label calibrated data', () => {
    const offenders = walk(SRC)
      .filter(f => /GTO play/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(f => relative(SRC, f).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });
});
