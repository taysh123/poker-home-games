/**
 * Local calendar-day key ('YYYY-MM-DD') from LOCAL date components — daily limits reset at the
 * user's local midnight. (The previous toISOString() key was UTC: in UTC+3 the "day" flipped at
 * 03:00 local, not midnight.) Device-clock tampering is accepted — local-first design, no server
 * dependency. Pure; caller may pass a Date for testability.
 */
export function localDayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
