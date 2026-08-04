import { Apple, Play } from 'lucide-react';
import { STORE_BADGES } from '@/lib/stores';
import { cn } from '@/lib/utils';

const ICONS = {
  app_store: Apple,
  google_play: Play,
} as const;

type StoreBadgesProps = {
  className?: string;
};

/**
 * App Store + Google Play badges. A badge with `href` (lib/stores.ts) renders as a REAL link —
 * focusable, opens the live listing. A badge without one renders DISABLED (not a link, dimmed,
 * aria-disabled, caption swapped to "Coming soon") — the shape this whole component used to
 * apply unconditionally, before the App Store listing went live. The honesty test enforces the
 * per-badge split.
 */
export function StoreBadges({ className }: StoreBadgesProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {STORE_BADGES.map((badge) => {
        const Icon = ICONS[badge.key];
        const content = (
          <>
            <Icon className={cn('h-6 w-6', badge.href ? 'text-textHigh' : 'text-textMuted')} aria-hidden="true" />
            <span className="flex flex-col leading-tight">
              <span className="text-[0.62rem] uppercase tracking-wide text-textMuted">
                {badge.href ? badge.caption : 'Coming soon'}
              </span>
              <span className="text-sm font-semibold text-textHigh">{badge.label}</span>
            </span>
          </>
        );

        if (badge.href) {
          return (
            <a
              key={badge.key}
              href={badge.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${badge.label} — download T Poker`}
              className={cn(
                'inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5',
                'transition hover:border-gold/60 hover:bg-surface/80',
              )}
            >
              {content}
            </a>
          );
        }

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
            {content}
          </div>
        );
      })}
    </div>
  );
}
