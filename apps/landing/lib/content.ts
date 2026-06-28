/**
 * Marketing copy. Positioning is strict throughout: a home-game MANAGER with a
 * coach built in — management + learning, NEVER "gambling" or "play for money."
 * The free manager is the hero; learning is the bonus.
 */
export const HERO = {
  eyebrow: 'Home-game manager + built-in coach',
  title: 'Run your home poker game — no mess, no arguments.',
  subhead:
    "Track cash games and tournaments, settle up automatically, and see who's really winning — all free. Want to get better between sessions? A personal coach is built in.",
  primaryCta: 'Start Free',
  primaryNote: 'Free to start — no credit card.',
  storeNote: 'Mobile apps coming soon',
} as const;

/** Four honest trust signals for the Social Proof strip. */
export const SOCIAL_PROOF_ITEMS = [
  {
    title: 'No real money — ever',
    sub: 'A management and scorekeeping tool for games you run yourself.',
  },
  {
    title: 'Transparent settlement math',
    sub: 'Everyone sees exactly how debts are calculated — always the fewest transfers.',
  },
  {
    title: 'Your group, your data',
    sub: 'Private games, private records. No public leaderboard.',
  },
  {
    title: 'Free forever',
    sub: 'All management tools at no cost, with no session or player limits.',
  },
] as const;

/** Outcome-focused benefit cards (3). Icons are assigned in the component layer. */
export const BENEFITS = [
  {
    title: 'No more arguing over who owes what',
    body: 'T Poker calculates the minimum number of transfers to clear all debts — automatically, transparently, every time.',
    tag: 'Settlement',
  },
  {
    title: 'All your games, all in one place',
    body: 'Session history, lifetime P&L, and a group leaderboard that finally settles the who-wins-most debate.',
    tag: 'Stats & history',
  },
  {
    title: 'Get better between sessions',
    body: 'Expert-Calibrated strategy packs help you plug leaks and make sharper decisions. AI Coach brings personalised feedback in Premium.',
    tag: 'Study · Premium',
  },
] as const;

/** How It Works — 3 sequential steps. */
export const HOW_IT_WORKS = {
  heading: 'Up and running in minutes',
  subhead: 'No setup fee. No friction. Just your game.',
  steps: [
    {
      number: '01',
      title: 'Create a game',
      body: 'Pick cash or tournament, name your game, set the buy-in amount — done in 30 seconds.',
    },
    {
      number: '02',
      title: 'Add players, track live',
      body: 'Buy-ins, rebuys, and cash-outs — one tap each. Your session stats update instantly.',
    },
    {
      number: '03',
      title: 'Settle automatically',
      body: 'T Poker calculates who pays whom with the fewest transfers. Share results or mark debts paid.',
    },
  ],
} as const;

/**
 * Pricing section copy + prices.
 * Monthly = $8.99/mo  |  Yearly = $79.99/yr total.
 * These are the canonical prices — do NOT hardcode them elsewhere.
 */
export const PRICING = {
  heading: 'Simple pricing',
  subhead: 'Every management tool is free. Upgrade for the full strategy library.',
  /** Monthly price in USD. */
  monthly: 8.99,
  /** Yearly total in USD (billed annually). */
  yearly: 79.99,
  free: {
    name: 'Free',
    badge: 'Always free',
    tagline: 'Every tool you need to run any game, at no cost.',
    items: [
      'Cash games & tournaments',
      'Buy-in / cash-out tracking',
      'Automatic debt settlement',
      'Session history & lifetime stats',
      'Group leaderboard',
      'Intro strategy tips (sampler)',
    ],
    cta: 'Start Free',
  },
  premium: {
    name: 'Premium',
    tagline: 'The full strategy library for players who want to improve.',
    cta: 'Get Premium',
  },
} as const;

/** FAQ accordion items. */
export const FAQ_ITEMS = [
  {
    q: 'Is this real-money gambling?',
    a: "No. T Poker is a management and scorekeeping tool for home games you run yourself. You don't wager, deposit, or win money inside the app — it just tracks cash you and your friends exchange in person.",
  },
  {
    q: 'Is the free version really free?',
    a: 'Yes. All game-management features — cash games, tournaments, buy-in tracking, automatic settlement, session history, and group stats — are free forever with no session or player limits. Premium adds the full strategy library.',
  },
  {
    q: 'What does "Expert-Calibrated" mean?',
    a: 'Our strategy content is based on sound poker fundamentals and proven principles — the concepts that reliably help home-game and recreational players improve. Every lesson is reviewed for quality and accuracy so you can trust the guidance.',
  },
] as const;

/** Final CTA section. */
export const FINAL_CTA = {
  heading: 'Ready to end the chaos?',
  sub: 'Start free — no credit card, no commitment.',
  cta: 'Start Free',
} as const;
