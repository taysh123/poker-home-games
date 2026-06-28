'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { FAQ_ITEMS } from '@/lib/content';

/**
 * FAQ accordion — keyboard-accessible, reduced-motion-safe.
 *
 * Accessibility:
 * - Each trigger is a <button> with aria-expanded + aria-controls.
 * - Each panel has role="region" + aria-labelledby pointing to its trigger.
 * - Visible focus ring (ring-gold, 2px offset).
 * - Chevron rotation is opacity/transform only (CLS-safe).
 *
 * Motion:
 * - Height animates 0 → auto via Framer Motion AnimatePresence (opacity too).
 * - Reduced-motion: immediate show/hide, no height transition, chevron static.
 */
export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <Section aria-labelledby="faq-heading">
      <Container className="max-w-3xl">
        <Reveal className="text-center">
          <h2 id="faq-heading" className="text-display">
            Questions? Answered.
          </h2>
        </Reveal>

        <div className="mt-12 divide-y divide-border/50">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const triggerId = `faq-trigger-${i}`;
            const panelId = `faq-panel-${i}`;

            return (
              <Reveal key={triggerId} delay={i * 0.07}>
                <div>
                  {/* Trigger */}
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={{ minHeight: '44px' }}
                  >
                    <span className="font-medium text-textHigh">{item.q}</span>

                    {/* Chevron — rotate on open; static when reduced-motion */}
                    {reduce ? (
                      <ChevronDown
                        className="h-5 w-5 shrink-0 text-textMuted transition-transform"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        aria-hidden="true"
                      />
                    ) : (
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="shrink-0"
                        aria-hidden="true"
                      >
                        <ChevronDown className="h-5 w-5 text-textMuted" />
                      </motion.span>
                    )}
                  </button>

                  {/* Panel */}
                  {reduce ? (
                    /* Reduced-motion: instant show/hide, no height animation */
                    isOpen ? (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={triggerId}
                      >
                        <p className="pb-5 leading-relaxed text-textMuted">{item.a}</p>
                      </div>
                    ) : null
                  ) : (
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={triggerId}
                          key={panelId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <p className="pb-5 leading-relaxed text-textMuted">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
