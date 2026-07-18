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

const title = 'T Poker — Home-game manager & poker study';
const description =
  'T Poker is a free home-game management and poker-study app — track buy-ins, settle up automatically, and see your session stats. It is not a gambling product: no real-money wagering, no deposits, no payouts. For adults 18+.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.siteUrl),
  title: {
    default: title,
    template: '%s · T Poker',
  },
  description,
  applicationName: SITE.name,
  keywords: [
    'home poker game',
    'poker home game manager',
    'poker buy-in tracker',
    'poker settlement',
    'poker stats',
    'cash game tracker',
    'poker tournament manager',
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
        alt: 'T Poker — run your home poker game, no mess, no arguments.',
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
  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable}`}>
      <body>
        <div className="bg-mesh" aria-hidden="true" />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}