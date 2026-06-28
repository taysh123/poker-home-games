import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Inter } from 'next/font/google';
import './globals.css';
import { SITE } from '@/lib/site';

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

const title = 'T Poker — Run your home poker game';
const description =
  'Track cash games and tournaments, settle up automatically, and see who is really winning — all free. Plus a personal coach when you want to improve.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.appUrl),
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
  openGraph: {
    title,
    description,
    siteName: SITE.name,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
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
        {children}
      </body>
    </html>
  );
}
