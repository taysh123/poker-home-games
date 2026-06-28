import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Centered content column (~1120px) with responsive horizontal padding. */
export function Container({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-container px-5 sm:px-8', className)} {...props}>
      {children}
    </div>
  );
}
