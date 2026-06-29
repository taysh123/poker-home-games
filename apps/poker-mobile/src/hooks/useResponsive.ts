import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoints for the web-first surfaces. Web = desktop multi-panel; mobile = single column.
 * `breakpointFor` is pure (unit-tested); `useResponsive` is the hook wrapper.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface Responsive {
  width: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function breakpointFor(width: number): Breakpoint {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}
