/**
 * UTC day-key ban (Wave 0.3). The local-midnight fix lives in features/study/logic/localDay.ts —
 * every study-facing "what day is it" MUST go through localDayKey(). The UTC shortcut
 * `toISOString().slice(0, 10)` resets at 02:00–03:00 Israel time and has now escaped the fix
 * three times (useReminderScheduler, StudyScreen, NotificationPreferencesScreen). This test
 * walks src/ and fails on any new occurrence outside the allowed files.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '../..');
const BANNED = /toISOString\(\)\.slice\(0,\s*10\)/;

// The only legitimate homes for day-key math (UTC parsing of already-local keys is fine there):
const ALLOWED = new Set([
  'features/study/logic/localDay.ts', // the local-midnight helper itself
  // Pure UTC ROUND-TRIP of already-local keys (dayNumber ⇄ dayKeyFromNumber) — keys enter via
  // localDayKey and are parsed/reconstructed in a self-consistent UTC number space. Not a clock read.
  'features/study/logic/progress.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('UTC day-key ban', () => {
  it('no file outside localDay.ts derives a day key via toISOString().slice(0, 10)', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      if (BANNED.test(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
