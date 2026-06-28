import { Apple, Play } from 'lucide-react';
import { STORE_BADGES } from '@/lib/stores';
import { cn } from '@/lib/utils';

const ICONS = {
  app_store: Apple,
  google_play: Play,
} as const;

type StoreBadgesProps = {
  className?: string;
  /** The small "not yet available" caption shown under the badges. */
  note?: string;
};

/**
 * App Store + Google Play badges, rendered DISABLED. They are not links (no
 * href, not focusable), dimmed, and marked aria-disabled — the apps aren't out
 * yet. The honesty test enforces that the underlying data carries no href.
 */
export function StoreBadges({ className, note = 'Coming soon' }: StoreBadgesProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {STORE_BADGES.map((badge) => {
          const Icon = ICONS[badge.key];
          return (
            <div
              key={badge.key}
              role="group"
              aria-disabled="true"
              aria-label={`${badge.label} — coming soon`}
              className={cn(
                'inline-flex cursor-not-allowed select-none items-center gap-3 rounded-xl',
                'border border-border/80 bg-surface/60 px-4 py-2.5 opacity-60',
              )}
            >
              <Icon className="h-6 w-6 text-textMuted" aria-hidden="true" />
              <span className="flex flex-col leading-tight">
                <span className="text-[0.62rem] uppercase tracking-wide text-textMuted">
                  {badge.caption}
                </span>
                <span className="text-sm font-semibold text-textHigh">{badge.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-textMuted">{note}</p>
    </div>
  );
}
