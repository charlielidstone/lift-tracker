# Lift Tracker — Decisions & Data Model

A running log of _what_ we decided and _why_. Append new entries; don't rewrite history.

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
   _Why:_ consistent names → reliable PR tracking + charts (no Bench/BP/Bench Press fragmentation).
2. **Track RPE** per set. _Why:_ Charlie trains seriously; cheap now, painful to backfill.
3. **Free logging** — no routine templates in v1. Exercises picked live (busy gym, ad-hoc).
4. **PR metric = best estimated 1RM** per exercise, via Epley: `1RM ≈ w × (1 + reps/30)`.
   _Why:_ puts every set on one comparable scale regardless of rep count. Valid ~1–10 reps.
   Computed on read, never stored. Rep-max board deferred to later.
5. **`user_id`** on Workout: stamped from auth session (not typed), enables row-level
   security so each user only sees their own data. Would be dropped if local-only.

## UX design philosophy

**Lowest possible friction between sets.** The app is used on a phone at the gym, mid-workout.
Every second of fumbling is a second not resting. Guiding rules:

- **No keyboard by default.** All values (weight, reps, RPE) adjust via big `[–]`/`[+]`
  steppers → thumb-friendly, no typing, no numeric-pad hunting.
- **Sensible pre-fill.** Adding an exercise creates ONE set already populated with defaults,
  so a "did it as planned" set is zero taps to log.
- **Short list.** Exercises collapse into cards; expand only the one you're working. Keeps
  the screen scannable between sets.
- **Adjust in place.** Tweak a value without expanding/drilling into a set.
- **Progressive disclosure.** Advanced input (tap-a-number-to-type for big jumps) comes later;
  v1 is steppers only.

### UX decisions

6. **Stepper increments:** weight ±5 lb, reps ±1, RPE ±1.
7. **Fixed defaults for a new set (v1):** weight 100 lb, reps 12, RPE 8.
   _Why fixed:_ simplest v1. Later: default to last workout's values per exercise.
8. **Tap-to-type on a value:** deferred. Steppers only for v1; add direct entry if the
   steppers prove annoying for big jumps (e.g. 100 → 225).

## Component tree

```
WorkoutView            -- the session: list of exercises + "add exercise"
  └─ ExerciseCard      -- one exercise, expand/collapse, its sets + "add set"
       └─ SetRow       -- one logged set; weight/reps/RPE via steppers + delete
            └─ Stepper -- reusable atom: label + value + [–]/[+]
```

- `Stepper` is a pure, reusable UI atom (label, value, step, onChange). Built once, used for
  every adjustable number. Lives in `src/components/`.
- Components hold UI state only; est. 1RM / PR math stays in `src/lib/` (see STANDARDS.md).

### Architecture

See `docs/architecture.html` for the visual map (layers, components, data flow).
Kept in sync as structure evolves.

### Deferred (not v1)

- Routine/template support
- Rep-max PR board (best weight per rep count)
- Rest timer
- Offline PWA
