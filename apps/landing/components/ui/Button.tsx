import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium min-h-[44px] transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary:
    'bg-gold text-background hover:bg-goldLight active:bg-goldDark shadow-[0_10px_34px_-12px_rgba(201,168,76,0.65)]',
  secondary: 'border border-gold/40 text-goldLight hover:border-gold hover:bg-gold/10',
} as const;

const sizes = {
  md: 'h-11 px-6 text-base',
  lg: 'h-14 px-8 text-lg',
} as const;

type CommonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    /** Opens in a new tab with rel="noopener noreferrer". */
    external?: boolean;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  if ('href' in props) {
    const { variant = 'primary', size = 'md', className, children, href, external, ...rest } = props;
    const externalAttrs = external
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {};
    return (
      <a
        href={href}
        className={cn(base, variants[variant], sizes[size], className)}
        {...externalAttrs}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const { variant = 'primary', size = 'md', className, children, type = 'button', ...rest } = props;
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}
