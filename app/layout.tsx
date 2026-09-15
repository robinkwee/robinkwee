import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import './v2.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const instrument = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://robinkwee.com';
const TITLE = 'Robin Kwee — AI × the Physical World';
const DESCRIPTION =
  'Manila-based builder applying AI to physical-world businesses — logistics, sports, health, distribution. Padel infrastructure in the Philippines.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s — Robin Kwee',
  },
  description: DESCRIPTION,
  applicationName: 'Robin Kwee',
  authors: [{ name: 'Robin Kwee', url: SITE_URL }],
  creator: 'Robin Kwee',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': `${SITE_URL}/blog/rss.xml` },
  },
  openGraph: {
    type: 'website',
    siteName: 'Robin Kwee',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
    images: [{ url: '/avatar.jpg', width: 600, height: 600, alt: 'Robin Kwee' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/avatar.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#060606',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
