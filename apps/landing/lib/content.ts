/**
 * Marketing copy.
 *
 * POSITIONING (standing principle — docs/release/store-submission-readiness.md): T Poker is a
 * poker STRATEGY-EDUCATION app plus a SCOREKEEPING utility (buy-in ledger + settlement
 * calculator). Learning leads; the manager is a ledger. NEVER "gambling", "play for money", or
 * anything that frames the product as a poker game. We submit under an individual Apple
 * Developer account, so a reviewer skimming this page for 20 seconds must not misread it.
 */
export const HERO = {
  eyebrow: 'Poker strategy training · Home-game scorekeeping',
  title: 'Learn poker properly — and keep the score straight on game night.',
  subhead:
    'Lessons, daily quizzes, and decision drills that sharpen how you think about poker. When friends come over, T Poker keeps the buy-in ledger and does the settlement math. No wagering, no money in the app — study and scorekeeping only.',
  primaryCta: 'Start Free',
  primaryNote: 'Free — no account needed.',
  storeNote: 'Mobile apps coming soon',
} as const;

/**
 * The plain-language "what this is / what this is not" statement. Rendered as its own section in
 * full body text — a reviewer must be able to find it without expanding an accordion.
 */
export const WHAT_IT_IS = {
  heading: 'What T Poker is — and what it is not',
  // Kept deliberately short: the three pillars above this paragraph already describe what the app
  // does, so this only has to carry what they cannot — the explicit negative statement.
  body:
    'T Poker is not a gambling product and it is not a poker game. There is no betting, no chance or random-outcome mechanic, and no money of any kind inside the app — nothing is wagered, deposited, held, won, or paid out. The amounts you see are notes you type about cash that friends exchange in person, exactly like a shared spreadsheet, and the only cards you will ever see are illustrations inside a lesson or a quiz question. T Poker is for adults 18+.',
} as const;

/**
 * Four honest trust signals for the Social Proof strip.
 *
 * Deliberately NOT another "no real money" line: the trust banner, `WHAT_IT_IS`, the first FAQ
 * answer and the footer all say it already. Saying it a fifth time in the space of one scroll makes
 * the page sound defensive, which is its own kind of red flag. These four carry product value.
 */
export const SOCIAL_PROOF_ITEMS = [
  {
    title: 'Explanations, not just answers',
    sub: 'Every quiz and drill tells you why — the reasoning is the point.',
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
    title: 'Free, with no account',
    sub: 'Study and run a full game night without signing up for anything.',
  },
] as const;

/** Section intro for the benefit cards. */
export const BENEFITS_INTRO = {
  heading: 'Sharper play. Cleaner nights.',
  subhead: 'Study between games. Keep the ledger straight during them.',
} as const;

/**
 * Outcome-focused benefit cards (3).
 *
 * `icon` names a lucide export that `Benefits.tsx` maps to a component. It lives HERE, on the entry,
 * rather than in a parallel index-keyed array in the component: reordering these cards once already
 * left every card wearing its neighbour's icon, and a positional array gives no warning when it
 * happens again.
 */
export const BENEFITS = [
  {
    // Study leads — it is the primary experience and it is entirely free today.
    icon: 'BookOpen',
    title: 'Get better between games',
    body: 'A daily quiz, starter lessons, and free practice hands every single day — free, no account needed. The full lesson library is coming later.',
    tag: 'Study · Free',
  },
  {
    icon: 'Scale',
    title: 'No more arguing over who owes what',
    body: 'T Poker calculates the minimum number of transfers to clear all debts — automatically, transparently, every time. You settle in cash, in person.',
    tag: 'Settlement',
  },
  {
    icon: 'BarChart2',
    title: 'All your games, all in one place',
    body: 'Session history, lifetime results, and a group leaderboard that finally settles the who-wins-most debate.',
    tag: 'Stats & history',
  },
] as const;

/**
 * How It Works — the SCOREKEEPING side, start to finish. Titled so it is clear this describes
 * bookkeeping for a game happening on your table, not a game happening in the app.
 */
export const HOW_IT_WORKS = {
  heading: 'Game night, handled',
  subhead: 'Three steps, about a minute of setup, and nobody argues at the end.',
  steps: [
    {
      number: '01',
      title: 'Start a session',
      body: 'Name the night, pick cash or tournament, set the buy-in amount — done in 30 seconds.',
    },
    {
      number: '02',
      title: 'Record as you go',
      body: 'Buy-ins, rebuys, and cash-outs — one tap each. The running totals update instantly.',
    },
    {
      number: '03',
      title: 'Settle up',
      body: 'T Poker works out who owes whom in the fewest transfers. You settle in cash, in person.',
    },
  ],
} as const;

/**
 * Pricing section copy.
 *
 * There are deliberately NO price fields here. Premium is not purchasable — not in the app, not on
 * the web — so the site must not quote a figure for it. Reintroduce prices only in the same change
 * that makes a feature `live` in `lib/features.ts`.
 */
export const PRICING = {
  heading: 'Simple pricing',
  subhead: 'Everything here is free today. Premium is in development — nothing is purchasable yet.',
  free: {
    name: 'Free',
    badge: 'Always free',
    tagline: 'Every tool you need to run any game, at no cost.',
    // Byte-for-byte the same six bullets as apps/poker-mobile/public/pricing.html, in the same
    // order. The free tier is one promise; a visitor should not find two differently-worded
    // versions of it depending on which page they landed on. Pinned by
    // __tests__/positioning.test.ts, which reads that HTML — a previous comment asserted the same
    // invariant with nothing behind it, and the two lists had already drifted apart.
    items: [
      'Cash games & tournaments',
      'Buy-ins, cash-outs & one-tap settlements',
      'Blind clock & prize-pool splits',
      'Groups, lifetime stats & leaderboards',
      'Daily quiz, starter lessons & free practice every day',
      'No account needed to start',
    ],
    cta: 'Start Free',
  },
  premium: {
    name: 'Premium',
    tagline: 'A deeper study experience for players who want to improve.',
    cta: "See what's coming",
    /** Rendered instead of a price: nothing is purchasable anywhere (honesty-test pinned). */
    priceNote: 'Coming soon',
    note: 'Premium cannot be purchased yet — there is no checkout anywhere in the app or on the web.',
  },
} as const;

/**
 * FAQ accordion items. The gambling question is first AND open by default — a reviewer must not
 * have to expand anything to find the answer.
 */
export const FAQ_ITEMS = [
  {
    q: 'Is this real-money gambling?',
    a: "No. T Poker is a poker strategy study app with a scorekeeping tool for home games you run yourself. There is no wagering, no deposits, no payouts, and no chance mechanic anywhere in it. You can't play a hand of poker in T Poker — you study, and you record cash that friends exchange in person.",
  },
  {
    q: 'Can I play poker in the app?',
    a: 'No. T Poker has no card game in it. The only cards you will see are illustrations inside a lesson or a quiz question. For your home game, the app is a ledger: you type in who bought in for what and who cashed out, and it works out who owes whom.',
  },
  {
    q: 'Do I need to be 18?',
    a: 'Yes. T Poker is intended for adults 18 and older. It is a study and scorekeeping tool for private home games — not a gambling product — and it never handles real-money wagers, deposits, or payouts.',
  },
  {
    q: 'What can I actually study for free?',
    a: 'A new quiz every day, three starter lessons, and ten practice hands a day across the trainers — free, with no account needed. The full lesson library and unlimited practice are planned for Premium, which is not available yet.',
  },
  {
    q: 'What does "Expert-Calibrated" mean?',
    a: 'Our strategy content is based on sound poker fundamentals and proven principles — the concepts that reliably help home-game and recreational players improve. Every lesson is reviewed for quality and accuracy so you can trust the guidance.',
  },
] as const;

/**
 * Final CTA section. "No credit card" was the old line — a purchase-adjacent reassurance on a site
 * whose whole point is that no checkout exists. It matches `HERO.primaryNote` now.
 */
export const FINAL_CTA = {
  heading: 'Ready to play better?',
  sub: 'Start free — no account needed, nothing to buy.',
  cta: 'Start Free',
} as const;
