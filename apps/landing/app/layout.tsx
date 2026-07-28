import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Inter } from 'next/font/google';
import './globals.css';
import { SITE } from '@/lib/site';
import { MotionProvider } from '../components/MotionProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-display',
});

// Education leads in the title, the tag, and the keywords — the same order the store listing uses
// (docs/release/store-submission-readiness.md). Nothing here should read as a poker game.
const title = 'T Poker — Learn poker strategy & keep score at home games';
const description =
  'T Poker teaches poker strategy with lessons, a daily quiz, and decision drills — and keeps the buy-in ledger for your home game, settling up in the fewest transfers. Not a gambling product: no wagering, no deposits, no payouts, no money in the app. For adults 18+.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.siteUrl),
  title: {
    default: title,
    template: '%s · T Poker',
  },
  description,
  applicationName: SITE.name,
  keywords: [
    'learn poker strategy',
    'poker training app',
    'poker lessons',
    'poker quiz',
    'poker strategy drills',
    'home poker game',
    'poker buy-in tracker',
    'poker settlement calculator',
  ],
  authors: [{ name: SITE.company }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title,
    description,
    siteName: SITE.name,
    type: 'website',
    locale: 'en_US',
    url: SITE.siteUrl,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'T Poker — learn poker strategy, and keep the score straight on game night.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0F1923',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Structured data (Q1.3). Strengthens tpoker.app as the SINGLE search entry point now that the
  // app host is de-indexed.
  //
  // DELIBERATELY NO `SoftwareApplication` NODE. Google's software rich result REQUIRES either
  // `offers` (a price) or `aggregateRating` (stars). We can honestly supply neither: nothing is
  // purchasable, and there are no reviews to cite. Including the node would have meant Search
  // Console reporting it as invalid and naming the two fields to "fix" it — manufacturing steady
  // pressure to fabricate a price or a star rating on the most machine-readable surface we own.
  // Organization + WebSite carry the entity/brand consolidation we actually want and require no
  // commerce fields. Pinned by __tests__/structuredData.test.ts — if a future reviewer wants the
  // node back, it must arrive with TRUE values, not with the pin deleted.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE.siteUrl}/#organization`,
        name: SITE.name,
        url: SITE.siteUrl,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.siteUrl}/#website`,
        url: SITE.siteUrl,
        name: SITE.name,
        description,
        publisher: { '@id': `${SITE.siteUrl}/#organization` },
      },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="bg-mesh" aria-hidden="true" />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}