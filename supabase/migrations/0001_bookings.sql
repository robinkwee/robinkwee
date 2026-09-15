-- Bookings made through robinkwee.com/call (voice agent or form).
--
-- Without this table the app still books calls, but double-booking protection
-- is limited to a single serverless instance and no record survives a restart.

create table if not exists public.bookings (
  id               uuid primary key,
  name             text        not null,
  email            text        not null,
  topic            text        not null,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  duration_minutes integer     not null check (duration_minutes between 15 and 60),
  status           text        not null default 'confirmed'
                               check (status in ('confirmed', 'cancelled')),
  source           text        not null default 'web'
                               check (source in ('web', 'voice')),
  created_at       timestamptz not null default now()
);

-- Robin can only take one call at a time: the race backstop behind the
-- application's availability read (surfaces to the app as SQLSTATE 23505).
create unique index if not exists bookings_confirmed_start_key
  on public.bookings (start_at)
  where status = 'confirmed';

-- Makes a caller's retry idempotent instead of sending a second invite.
create unique index if not exists bookings_confirmed_email_start_key
  on public.bookings (email, start_at)
  where status = 'confirmed';

create index if not exists bookings_start_at_idx on public.bookings (start_at);

-- The app talks to this table with the service-role key only; no anon access.
alter table public.bookings enable row level security;
