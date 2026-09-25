# Lift Tracker — Decisions & Data Model

A running log of *what* we decided and *why*. Append new entries; don't rewrite history.

## v1 scope

- **Platform:** Web app (Vite + React) — works in phone browser + desktop.
- **Storage:** Cloud-synced via Supabase (hosted Postgres + auth + row-level security).
- **Core v1 features:** fast set logging during a workout; progress + PR charts.
- **Build order:** UI first against local state, wire Supabase in after.

## Data model (v1 — locked)

```
Exercise
  id, name, muscle_group, is_custom      -- seeded library + user additions

Workout
  id, user_id, date, name, notes

SetEntry
  id, workout_id, exercise_id,
  weight, reps, rpe, set_order           -- est_1rm computed, NOT stored
```

### Decisions

1. **Exercises = fixed library**, seeded, with user-added custom entries.
   *Why:* consistent names → reliable PR tracking + charts (no Bench/BP/Bench Press fragmentation).
2. **Track RPE** per set. *Why:* Charlie trains seriously; cheap now, painful to backfill.
3. **Free logging** — no routine templates in v1. Exercises picked live (busy gym, ad-hoc).
4. **PR metric = best estimated 1RM** per exercise, via Epley: `1RM ≈ w × (1 + reps/30)`.
   *Why:* puts every set on one comparable scale regardless of rep count. Valid ~1–10 reps.
   Computed on read, never stored. Rep-max board deferred to later.
5. **`user_id`** on Workout: stamped from auth session (not typed), enables row-level
   security so each user only sees their own data. Would be dropped if local-only.

### Deferred (not v1)

- Routine/template support
- Rep-max PR board (best weight per rep count)
- Rest timer
- Offline PWA
