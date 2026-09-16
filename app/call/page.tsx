import type { Metadata } from 'next';
import Link from 'next/link';
import CalendlyEmbed from './CalendlyEmbed';
import { buildCalendlyEmbedUrl, schedulingUrl } from '@/lib/calendly';

const CONTACT_EMAIL = 'robinkwee@gmail.com';

export const metadata: Metadata = {
  title: 'Book a call',
  description:
    'Book a 30-minute call with Robin Kwee. Pick a time that works — you will get a calendar invite with a Google Meet link.',
  alternates: { canonical: '/call' },
  openGraph: {
    title: 'Book a call with Robin Kwee',
    description: 'Pick a time. Calendar invite and Google Meet link included.',
    url: '/call',
  },
};

export default function CallPage() {
  const bookingUrl = schedulingUrl();

  return (
    <main className="min-h-dvh bg-[#0d0d0d] text-white">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-10">
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 transition-colors hover:text-gray-400"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Robin Kwee
          </Link>
        </div>

        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Book a call.</h1>
        <p className="mb-8 text-sm text-gray-500">
          Grab a 30-minute slot. You&apos;ll get a calendar invite with a Google Meet link, and you
          can reschedule from that invite any time.
        </p>

        {bookingUrl ? (
          <CalendlyEmbed
            embedUrl={buildCalendlyEmbedUrl(bookingUrl)}
            schedulingUrl={bookingUrl}
          />
        ) : (
          /*
           * No scheduling link configured. Showing an empty or broken embed
           * here would be worse than saying so — this at least still gets the
           * visitor to Robin.
           */
          <div className="rounded-xl border border-gray-800 bg-[#111] p-6">
            <p className="text-sm text-gray-300">Online booking isn&apos;t set up yet.</p>
            <p className="mt-2 text-sm text-gray-500">
              Email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              with a couple of times that suit you and Robin will confirm one.
            </p>
            <p className="mt-4 text-xs text-gray-600">
              Manila time (UTC+8). WhatsApp also works:{' '}
              <a
                href="https://api.whatsapp.com/send?phone=639178482217"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 underline underline-offset-4 hover:text-gray-200"
              >
                message Robin
              </a>
              .
            </p>
          </div>
        )}

        <div className="mt-12 border-t border-gray-900 pt-6 text-center">
          <p className="text-xs text-gray-600">
            Prefer email?{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gray-400 transition-colors hover:text-gray-200"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
