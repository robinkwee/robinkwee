import type { Metadata, Viewport } from 'next';
import { Instrument_Serif } from 'next/font/google';
import './v2.css';

const instrument = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument',
});

export const metadata: Metadata = {
  title: 'Robin Kwee — AI × the Physical World',
  description:
    'Manila-based builder applying AI to physical-world businesses — logistics, sports, health, distribution. Padel infrastructure in the Philippines.',
};

export const viewport: Viewport = {
  themeColor: '#060606',
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${instrument.variable} v2-root`}>{children}</div>;
}
