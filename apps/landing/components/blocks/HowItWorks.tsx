'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { HOW_IT_WORKS } from '@/lib/content';

/**
 * Three-step "How It Works" section.
 *
 * Desktop: horizontal timeline. The gold connector line between steps draws
 * from left to right as the section scrolls into view (scroll-progress via
 * Framer Motion useScroll + useTransform → scaleX, transform-only, CLS-safe).
 * Reduced-motion: line renders at full width immediately — static, no scroll effect.
 *
 * Mobile: steps stack vertically with a simple dashed vertical accent.
 */
export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 80%', 'end 30%'],
  });
  const lineScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section
      className="bg-surface/30"
      aria-labelledby="hiw-heading"
    >
      <Container>
        {/* Heading */}
        <Reveal className="text-center">
          <h2 id="hiw-heading" className="text-display">
            {HOW_IT_WORKS.heading}
          </h2>
          <p className="mt-4 text-lg text-textMuted">{HOW_IT_WORKS.subhead}</p>
        </Reveal>

        {/* Steps */}
        <div ref={containerRef} className="relative mt-16">

          {/*
            Connector line — desktop only (hidden on mobile).
            Base track: faint border colour.
            Animated fill: gold gradient, scaleX from 0→1 (origin-left).
            Positioned at vertical center of the number circles (h-14 = 56px → top-7 = 28px).
            Left/right offset = 1/6 of container width (center of outermost columns in a 3-col grid).
          */}
          <div
            className="absolute left-[calc(100%/6)] right-[calc(100%/6)] top-7 hidden h-px bg-border/50 lg:block"
            aria-hidden="true"
          >
            {reduce ? (
              <div className="absolute inset-0 bg-gradient-to-r from-gold/50 via-gold/30 to-transparent" />
            ) : (
              <motion.div
                className="absolute inset-0 origin-left bg-gradient-to-r from-gold/60 via-gold/35 to-transparent"
                style={{ scaleX: lineScaleX }}
              />
            )}
          </div>

          {/* Step grid */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
            {HOW_IT_WORKS.steps.map((step, i) => (
              <Reveal key={step.number} delay={0.1 + i * 0.14}>
                <div className="flex flex-col items-center text-center lg:items-center">
                  {/* Number circle */}
                  <div
                    className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/35 bg-background text-gold"
                    aria-hidden="true"
                  >
                    <span className="font-display text-lg leading-none">{step.number}</span>

                    {/* Vertical connector between steps on mobile */}
                    {i < HOW_IT_WORKS.steps.length - 1 && (
                      <div className="absolute left-1/2 top-full mt-1 h-10 w-px -translate-x-1/2 bg-border/50 lg:hidden" />
                    )}
                  </div>

                  <h3 className="mt-6 text-xl text-text">{step.title}</h3>
                  <p className="mt-2 max-w-xs leading-relaxed text-textMuted">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
