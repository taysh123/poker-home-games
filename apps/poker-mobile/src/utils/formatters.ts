export function formatPL(value: number): string {
  const abs = Math.abs(Math.round(value));
  return `${value >= 0 ? '+' : '-'}₪${abs.toLocaleString()}`;
}

export function formatMoney(value: number): string {
  return `₪${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(startedAt: string, endedAt: string): string {
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
