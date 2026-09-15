import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Where bookings live.
 *
 * Bookings used to be fire-and-forget emails: nothing recorded the slot, so
 * two callers could take the same one and a dropped email erased the booking
 * with no trace. When Supabase is configured this is the durable record and
 * the double-booking guard; otherwise it degrades to a per-instance cache
 * that still blocks duplicates inside one process. Booking never hard-fails
 * because storage is unavailable — a lost record is better than a lost call.
 */

export type BookingSource = 'web' | 'voice';
export type BookingStatus = 'confirmed' | 'cancelled';

export interface BookingRecord {
  id: string;
  name: string;
  email: string;
  topic: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: BookingStatus;
  source: BookingSource;
  created_at: string;
}

export type ReserveResult =
  | { ok: true; persisted: boolean }
  | { ok: false; reason: 'conflict' | 'duplicate' };

export const BOOKINGS_TABLE = 'bookings';

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export function isPersistent(): boolean {
  return supabase() !== null;
}

/** Fallback store. Per-instance only — see the module comment. */
const memory = new Map<string, BookingRecord>();

/** Test seam: reset the in-memory fallback. */
export function __resetMemoryStore() {
  memory.clear();
  client = undefined;
}

function overlaps(a: BookingRecord, startISO: string, endISO: string): boolean {
  return a.start_at < endISO && a.end_at > startISO;
}

/** Confirmed bookings that intersect [fromISO, toISO). */
export async function listBookings(fromISO: string, toISO: string): Promise<BookingRecord[]> {
  const db = supabase();
  if (!db) {
    return [...memory.values()].filter(
      (b) => b.status === 'confirmed' && overlaps(b, fromISO, toISO)
    );
  }

  const { data, error } = await db
    .from(BOOKINGS_TABLE)
    .select('*')
    .eq('status', 'confirmed')
    .lt('start_at', toISO)
    .gt('end_at', fromISO)
    .order('start_at', { ascending: true });

  if (error) {
    // Availability is advisory; never block a booking on a read failure.
    console.error('[booking] availability read failed:', error.message);
    return [];
  }
  return (data ?? []) as BookingRecord[];
}

/**
 * Claim the slot. Returns `conflict` when it overlaps a confirmed booking and
 * `duplicate` when this address already holds that exact slot, which is what
 * makes a retry — or a model calling the tool twice — idempotent.
 */
export async function reserve(record: BookingRecord): Promise<ReserveResult> {
  const db = supabase();

  if (!db) {
    for (const existing of memory.values()) {
      if (existing.status !== 'confirmed') continue;
      if (existing.email === record.email && existing.start_at === record.start_at) {
        return { ok: false, reason: 'duplicate' };
      }
      if (overlaps(existing, record.start_at, record.end_at)) {
        return { ok: false, reason: 'conflict' };
      }
    }
    memory.set(record.id, record);
    return { ok: true, persisted: false };
  }

  const clashes = await listBookings(record.start_at, record.end_at);
  const duplicate = clashes.find(
    (b) => b.email === record.email && b.start_at === record.start_at
  );
  if (duplicate) return { ok: false, reason: 'duplicate' };
  if (clashes.length > 0) return { ok: false, reason: 'conflict' };

  const { error } = await db.from(BOOKINGS_TABLE).insert(record);

  if (error) {
    // 23505 = unique violation: the partial unique index on (start_at) caught
    // a race that the read above could not see.
    if (error.code === '23505') return { ok: false, reason: 'conflict' };
    console.error('[booking] insert failed, falling back to memory:', error.message);
    memory.set(record.id, record);
    return { ok: true, persisted: false };
  }

  return { ok: true, persisted: true };
}

/** Undo a reservation whose confirmation email could not be sent. */
export async function release(id: string): Promise<void> {
  const db = supabase();
  if (!db) {
    memory.delete(id);
    return;
  }
  const { error } = await db
    .from(BOOKINGS_TABLE)
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) console.error('[booking] release failed:', error.message);
  memory.delete(id);
}
