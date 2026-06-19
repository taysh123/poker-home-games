import { getActiveCurrency, formatIntlMajor, type CurrencyCode } from './currency';

export function formatPL(value: number, code: CurrencyCode = getActiveCurrency()): string {
  const abs = Math.abs(Math.round(value));
  if (code === 'ILS') return `${value >= 0 ? '+' : '-'}₪${abs.toLocaleString()}`;
  return `${value >= 0 ? '+' : '-'}${formatIntlMajor(abs, code, 0)}`;
}

export function formatMoney(value: number, code: CurrencyCode = getActiveCurrency()): string {
  if (code === 'ILS') return `₪${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return formatIntlMajor(Math.abs(value), code, 2);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return formatDate(dateStr);
}

export function formatDuration(startedAt: string, endedAt: string): string {
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
