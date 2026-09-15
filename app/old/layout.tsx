import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Robin Kwee' },
  description: 'Ecommerce, Padel, Farming, Coding, Systems — Philippines',
  alternates: { canonical: '/old' },
};

/**
 * Nested layout for the archived V1 profile. The root layout owns <html>/<body>
 * and the font variables; this only re-applies V1's night-sky background.
 */
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <div className="legacy-page">{children}</div>;
}
