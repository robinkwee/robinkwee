'use client';

import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';

/**
 * The deterministic booking path.
 *
 * Booking used to be possible only by talking to Aria, which meant it did not
 * work at all in browsers without the Web Speech API, in a noisy room, or for
 * anyone who cannot or would rather not speak — and it staked the caller's
 * email address on a speech transcription. This form is always available and
 * hits the same validated endpoint the agent's tool does.
 */

const DURATIONS = [15, 30, 45, 60] as const;
const DAYS_OFFERED = 14;

export interface BookingSuccess {
  bookingRef: string;
  whenManila: string;
  meetLink: string | null;
  durationMinutes: number;
}

interface Slot {
  startISO: string;
  label: string;
}

interface SlotsResponse {
  date: string;
  slots: Slot[];
  isBusinessDay: boolean;
}

const manilaDateKey = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);

const manilaDayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00Z`));

/** The next `count` weekdays in Manila, starting today. */
function upcomingBusinessDays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  for (let i = 0; days.length < count && i < count * 3; i++) {
    const key = manilaDateKey(cursor);
    const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
    if (weekday >= 1 && weekday <= 5) days.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * The bookable days depend on "now", which the statically rendered HTML cannot
 * know. `useSyncExternalStore` gives the server an empty list and the client
 * the real one without a hydration mismatch; the snapshot is cached per Manila
 * day so its identity stays stable across renders.
 */
const NO_DAYS: string[] = [];
let cachedDayKey = '';
let cachedDays: string[] = NO_DAYS;

function businessDaysSnapshot(): string[] {
  const today = manilaDateKey(new Date());
  if (today !== cachedDayKey) {
    cachedDayKey = today;
    cachedDays = upcomingBusinessDays(DAYS_OFFERED);
  }
  return cachedDays;
}

const neverChanges = () => () => {};

export default function BookingForm({
  onBooked,
  prefill,
}: {
  onBooked?: (booking: BookingSuccess) => void;
  prefill?: { name?: string; email?: string; topic?: string };
}) {
  const uid = useId();
  const days = useSyncExternalStore(neverChanges, businessDaysSnapshot, () => NO_DAYS);

  const [name, setName] = useState(prefill?.name ?? '');
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [topic, setTopic] = useState(prefill?.topic ?? '');
  const [duration, setDuration] = useState<number>(30);
  const [chosenDate, setChosenDate] = useState('');
  const [chosenSlot, setChosenSlot] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<BookingSuccess | null>(null);

  const date = chosenDate || days[0] || '';
  const requestKey = `${date}|${duration}|${refreshToken}`;

  // Loading is derived from "which request have we got an answer for?" rather
  // than a flag set synchronously inside the effect.
  const [loaded, setLoaded] = useState<{ key: string; slots: Slot[]; error: string | null } | null>(
    null
  );
  const loadingSlots = date !== '' && loaded?.key !== requestKey;
  const slots = loaded?.key === requestKey ? loaded.slots : [];

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();

    fetch(`/api/book?date=${encodeURIComponent(date)}&duration=${duration}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<SlotsResponse>) : Promise.reject(res.status)))
      .then((data) => setLoaded({ key: requestKey, slots: data.slots, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('slot load failed', err);
        setLoaded({
          key: requestKey,
          slots: [],
          error: 'Could not load available times. Please try again.',
        });
      });

    return () => controller.abort();
  }, [date, duration, requestKey]);

  const startISO = slots.some((s) => s.startISO === chosenSlot)
    ? chosenSlot
    : (slots[0]?.startISO ?? '');

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting || !startISO) return;

      setSubmitting(true);
      setFormError(null);
      setFieldErrors({});

      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, topic, startISO, durationMinutes: duration }),
        });
        const data = await res.json();

        if (!res.ok) {
          setFieldErrors(data.fieldErrors ?? {});
          setFormError(data.error ?? 'Something went wrong. Please try again.');
          // A taken slot means the times on screen are stale.
          if (res.status === 409) setRefreshToken((n) => n + 1);
          return;
        }

        const success: BookingSuccess = {
          bookingRef: data.bookingRef,
          whenManila: data.whenManila,
          meetLink: data.meetLink ?? null,
          durationMinutes: data.durationMinutes,
        };
        setBooking(success);
        onBooked?.(success);
      } catch (err) {
        console.error('booking failed', err);
        setFormError(
          'We could not reach the booking service. Please email robinkwee@gmail.com instead.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [duration, email, name, onBooked, startISO, submitting, topic]
  );

  const dayOptions = useMemo(
    () => days.map((key) => ({ key, label: manilaDayLabel(key) })),
    [days]
  );

  if (booking) {
    return (
      <div
        className="rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-5 text-sm"
        role="status"
      >
        <p className="font-medium text-emerald-300">Your call is booked.</p>
        <dl className="mt-3 space-y-1 text-gray-300">
          <div className="flex gap-2">
            <dt className="text-gray-500">When</dt>
            <dd>{booking.whenManila}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500">Length</dt>
            <dd>{booking.durationMinutes} minutes</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500">Ref</dt>
            <dd className="font-mono">{booking.bookingRef}</dd>
          </div>
        </dl>
        <p className="mt-3 text-gray-400">
          A calendar invite is on its way to <span className="text-gray-200">{email}</span>. Check
          spam if it does not land in a minute.
        </p>
        <button
          type="button"
          onClick={() => {
            setBooking(null);
            setRefreshToken((n) => n + 1);
          }}
          className="mt-4 text-xs text-gray-500 underline underline-offset-4 hover:text-gray-300"
        >
          Book another call
        </button>
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-lg border border-gray-800 bg-[#111] px-3 py-2 text-sm text-white ' +
    'placeholder:text-gray-600 focus:border-emerald-700 focus:outline-none';
  const labelClass = 'block text-xs uppercase tracking-widest text-gray-500 mb-1.5';
  const errorClass = 'mt-1 text-xs text-red-400';

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className={labelClass} htmlFor={`${uid}-name`}>
          Your name
        </label>
        <input
          id={`${uid}-name`}
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          maxLength={80}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `${uid}-name-error` : undefined}
        />
        {fieldErrors.name && (
          <p id={`${uid}-name-error`} className={errorClass}>
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor={`${uid}-email`}>
          Email for the invite
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          className={fieldClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={254}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${uid}-email-error` : undefined}
        />
        {fieldErrors.email && (
          <p id={`${uid}-email-error`} className={errorClass}>
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor={`${uid}-topic`}>
          What is it about?
        </label>
        <input
          id={`${uid}-topic`}
          className={fieldClass}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Padel partnership, AI for logistics, hiring…"
          required
          maxLength={140}
          aria-invalid={Boolean(fieldErrors.topic)}
          aria-describedby={fieldErrors.topic ? `${uid}-topic-error` : undefined}
        />
        {fieldErrors.topic && (
          <p id={`${uid}-topic-error`} className={errorClass}>
            {fieldErrors.topic}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${uid}-date`}>
            Day
          </label>
          <select
            id={`${uid}-date`}
            className={fieldClass}
            value={date}
            onChange={(e) => {
              setChosenDate(e.target.value);
              setChosenSlot('');
            }}
            disabled={dayOptions.length === 0}
          >
            {dayOptions.length === 0 && <option value="">Loading…</option>}
            {dayOptions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${uid}-duration`}>
            Length
          </label>
          <select
            id={`${uid}-duration`}
            className={fieldClass}
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              setChosenSlot('');
            }}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelClass}>Time (Manila)</span>
        {loadingSlots ? (
          <p className="text-xs text-gray-600">Checking Robin&apos;s calendar…</p>
        ) : loaded?.error ? (
          <p className="text-xs text-red-400">{loaded.error}</p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nothing free that day. Try another, or email robinkwee@gmail.com.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Available times">
            {slots.map((slot) => {
              const selected = slot.startISO === startISO;
              return (
                <button
                  key={slot.startISO}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChosenSlot(slot.startISO)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200'
                      : 'border-gray-800 bg-[#111] text-gray-400 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {formError && (
        <p
          className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300"
          role="alert"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !startISO}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Booking…' : 'Book the call'}
      </button>

      <p className="text-center text-[11px] text-gray-600">
        Weekdays, 9am–6pm Manila time. You will get a calendar invite by email.
      </p>
    </form>
  );
}
