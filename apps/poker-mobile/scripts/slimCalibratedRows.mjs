/**
 * Q1.1 — regenerates src/features/study/data/calibratedRows.ts from the content repo's
 * range_viewer_database pack. Committed output; run manually after a content drop:
 *
 *   node scripts/slimCalibratedRows.mjs
 *
 * Emits ONLY the trainer-consumed scenario family (5 RFI + 4 BB-defense — the app's
 * RFI | vs_RFI union) and only the columns the converter reads. The pure converter
 * (logic/rangeConvert.ts) validates the result fail-closed at test time.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const packPath = resolve(here, '../../../content/release-0.8.1/exports/0.8.1/packs/range_viewer_database.pack.json');
const outPath = resolve(here, '../src/features/study/data/calibratedRows.ts');

const WANTED = /^(RFI \w+ \d+bb \d+-max|BB Defense vs \w+ [\d.]+bb( \d+-max| \(BvB\)))$/;

const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const rows = pack.rows
  .filter(r => WANTED.test(r.Scenario))
  .map(r => ({ Scenario: r.Scenario, Hand: r.Hand, Action: r.Action, Frequency: r.Frequency, VerificationTier: r.VerificationTier }))
  // Deterministic order so a regeneration diffs cleanly regardless of source row order.
  .sort((a, b) => a.Scenario.localeCompare(b.Scenario) || a.Hand.localeCompare(b.Hand));

const scenarios = [...new Set(rows.map(r => r.Scenario))];
if (scenarios.length !== 9 || rows.length !== 9 * 169) {
  throw new Error(`expected 9 complete scenarios (${9 * 169} rows), got ${scenarios.length} (${rows.length} rows)`);
}
// Every scenario in this family is a 100bb spot; the slim rows drop EffectiveStack, so the
// converter's stackBb=100 assumption is asserted HERE against the source instead.
const stacks = [...new Set(pack.rows.filter(r => WANTED.test(r.Scenario)).map(r => r.EffectiveStack))];
if (stacks.length !== 1 || stacks[0] !== '100bb') {
  throw new Error(`expected a uniform 100bb family, got [${stacks.join(', ')}]`);
}

// Provenance: manifest keys are snake_case (dataset_version, content_hash).
const version = pack.manifest?.dataset_version ?? 'unknown';
const hash = pack.manifest?.content_hash ?? 'unknown';
const header = `/**
 * GENERATED — do not edit. Source: content/release-0.8.1 range_viewer_database
 * (dataset ${version}, content hash ${hash}). Regenerate:
 *   node scripts/slimCalibratedRows.mjs
 * ${scenarios.length} scenarios × 169 hands, uniform 'Calibrated' tier @ 100bb — validated
 * fail-closed by logic/rangeConvert.ts via data/__tests__/calibratedRanges.test.ts.
 */
import type { CalibratedRangeRow } from '../logic/rangeConvert';

export const CALIBRATED_ROWS: CalibratedRangeRow[] = `;

writeFileSync(outPath, header + JSON.stringify(rows) + ';\n');
console.log(`wrote ${rows.length} rows / ${scenarios.length} scenarios -> ${outPath}`);
scenarios.forEach(s => console.log('  ·', s));
