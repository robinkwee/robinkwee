# Supabase schema

The app uses one table, `workouts`, read by `lib/workouts.ts` for the `/log`
activity heatmap and written by `POST /api/habits/workout`.

It is reached with `SUPABASE_SERVICE_ROLE_KEY` from server code only. Without
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` the log page renders an empty
heatmap rather than failing.

Bookings are not stored here — Calendly owns scheduling data.
