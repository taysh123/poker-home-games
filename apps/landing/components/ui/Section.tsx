import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Vertical-rhythm wrapper for page sections. */
export function Section({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('py-20 sm:py-28', className)} {...props}>
      {children}
    </section>
  );
}
