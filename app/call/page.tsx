import type { Metadata } from 'next';
import CallExperience from './CallExperience';

export const metadata: Metadata = {
  title: 'Book a call',
  description:
    'Book a 30-minute call with Robin Kwee. Talk to Aria or use the booking form — weekdays, 9am–6pm Manila time.',
  alternates: { canonical: '/call' },
  openGraph: {
    title: 'Book a call with Robin Kwee',
    description: 'Weekdays, 9am–6pm Manila time. Calendar invite by email.',
    url: '/call',
  },
};

export default function CallPage() {
  return <CallExperience />;
}
