'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Initial downward offset in px. */
  y?: number;
};

/**
 * Fade + rise as it scrolls into view, once.
 * MotionConfig reducedMotion="user" (in layout) handles prefers-reduced-motion globally —
 * no DOM branching needed here. Transform/opacity only (CLS-safe).
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}