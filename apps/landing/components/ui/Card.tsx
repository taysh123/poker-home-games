import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Glass surface with a subtle gold-tinted hairline border. */
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gold/15 bg-surface/70 backdrop-blur-sm',
        'shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
