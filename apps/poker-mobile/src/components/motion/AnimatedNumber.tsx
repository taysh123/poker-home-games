import React, { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

type Props = TextProps & {
  /** Target numeric value (any unit — formatting is up to `format`). */
  value: number;
  /** Renders the in-flight number, e.g. cents → "₪1,234". */
  format: (value: number) => string;
  /** Count-up duration in ms (default 800). */
  duration?: number;
};

/**
 * Count-up number. Plain rAF (not reanimated) — text content changes every
 * frame anyway, so a JS loop is the cheapest cross-platform implementation.
 */
export default function AnimatedNumber({ value, format, duration = 800, ...rest }: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      setDisplay(value);
      return;
    }
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text {...rest}>{format(display)}</Text>;
}
