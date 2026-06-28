'use client';

import { Fragment } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

const container: Variants = {
  hidden: {},
  visible: (delay = 0) => ({
    transition: { staggerChildren: 0.06, delayChildren: delay },
  }),
};

const word: Variants = {
  hidden: { opacity: 0, y: '0.3em' },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

type AnimatedTextProps = {
  text: string;
  className?: string;
  /** Seconds to wait before the first word reveals. */
  delay?: number;
};

/**
 * Staggered word-by-word reveal (Framer). Honors prefers-reduced-motion by
 * rendering the final text instantly. Renders an inline <span>, so callers wrap
 * it in the semantic element (e.g. <h1>) they need.
 */
export function AnimatedText({ text, className, delay = 0 }: AnimatedTextProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <span className={className}>{text}</span>;
  }

  const words = text.split(' ');

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={container}
      custom={delay}
    >
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <motion.span className="inline-block" variants={word}>
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </motion.span>
  );
}
