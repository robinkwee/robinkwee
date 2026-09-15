# Supabase schema

Apply migrations in order against the project referenced by `SUPABASE_URL`:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_bookings.sql
```

or paste the file into the Supabase SQL editor.

| Table      | Used by                                        |
| ---------- | ---------------------------------------------- |
| `bookings` | `lib/booking/store.ts` — call bookings          |
| `workouts` | `lib/workouts.ts` — the `/log` activity heatmap |

Both are reached with `SUPABASE_SERVICE_ROLE_KEY` from server code only. Row
level security is on and no policies are granted, so the anon key cannot read
or write either table.

Without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` the booking store falls
back to per-instance memory: bookings still send invites, but they are not
persisted and double-booking protection does not span instances.
