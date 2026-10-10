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
- **Adjust in place, no reflow.** Each value shows as a compact chip; tap it to reveal the
  `[–]`/`[+]` stepper as an OVERLAY floating on top of the row — the chips keep their slots so
  nothing shifts. Tap the number again, or anywhere outside the row, to collapse. The active
  value enlarges + animates (grow/fade) so it's clear which one you're editing.
  _Why the overlay:_ fixed rows fit a small phone screen with no horizontal scrolling, and the
  layout never jumps around as you edit (earlier scroll-the-row approach was replaced).
- **Guard destructive actions selectively.** Removing an exercise (deletes all its sets) asks
  for confirmation; deleting a single set does not (cheap to redo, confirmation would nag).
- **Progressive disclosure.** Advanced input (tap-a-number-to-type for big jumps) comes later;
  v1 is steppers only.

### UX decisions

6. **Stepper increments:** weight ±5 lb, reps ±1, RPE ±1.
7. **Fixed defaults for a new set (v1):** weight 100 lb, reps 12, RPE 8. But **"Add set" copies
   the previous set's** weight/reps/rpe; defaults apply only to the first set of an exercise.
   _Why:_ consecutive sets are usually identical → zero taps.
8. **Tap-to-type on a value:** deferred. Steppers only for v1; add direct entry if the
   steppers prove annoying for big jumps (e.g. 100 → 225).
9. **Tap-to-edit overlay** (not always-visible steppers): one value editable at a time, opens
   over the row without reflow. Replaces the earlier "all steppers visible + horizontal scroll".
10. **Confirm exercise removal**, not set removal (see philosophy above).

## Component tree

```
App                    -- Today | History tab switch (useState, no router)
  ├─ WorkoutView       -- the session: list of exercises + "add exercise"
  │    └─ ExerciseCard -- one exercise, expand/collapse, its sets + "add set" + remove-confirm
  │         └─ SetRow  -- one logged set; row of EditableStats + delete (one active at a time)
  │              └─ EditableStat -- chip (collapsed) ⇄ Stepper overlay (active); tap to toggle
  │                   └─ Stepper -- reusable atom: [–] value label [+], icon buttons
  └─ WorkoutHistory    -- read-only past workouts, newest first, grouped by day (Cards)
```

- `Stepper` is a pure, reusable UI atom (label, value, step, onChange). Built once, used for
  every adjustable number. Lives in `src/components/`.
- `EditableStat` wraps a value: compact chip when idle, expands to a `Stepper` overlay on tap.
- Components hold UI state only; est. 1RM / PR math stays in `src/lib/` (see STANDARDS.md).

### Architecture

See `docs/architecture.html` for the visual map (layers, components, data flow).
Kept in sync as structure evolves.

### Deferred (not v1)

- Routine/template support
- Rep-max PR board (best weight per rep count)
- Rest timer
- Offline PWA

## Offline / local-first sync (implemented)

Goal: log a whole workout at the gym with no/spotty signal; sync when back online.

- **Two-slice design.** Slice 1: localStorage cache (`lib/localCache.js`) — instant,
  offline-safe reload. Slice 2: an outbox that pushes edits made offline once the
  connection returns.
- **Three cache keys, namespaced by `user + date`:**
  - `workout:*` — the DESIRED state (what's on screen), write-through on every change.
  - `synced:*` — the last SERVER-CONFIRMED snapshot (the outbox BASELINE).
  - `library:*` — the exercise library.
- **Why a separate synced snapshot?** The pending outbox = `diff(desired, synced)`.
  If we only cached desired state, an offline reload would rehydrate the baseline
  FROM desired → diff empty → offline edits silently lost. Persisting the synced
  baseline separately makes pending edits survive a reload. (Proven by
  `offlineOutbox.test.js`.)
- **Diff logic is pure + tested** (`lib/syncDiff.js`): `diffOps` → inserts/updates/
  setDeletes/exerciseDeletes; a whole-exercise removal collapses to one delete.
- **Flush** runs debounced (700ms) AND on the `online` event (reconnect drains the
  outbox). Baseline only advances after writes succeed; on failure the pending flag
  stays set so the next edit/reconnect retries. Client-generated UUIDs mean retries
  are idempotent-ish (same ids).
- **Conflict policy:** last-write-wins, single-user assumption. If the server has a
  copy AND there are local pending edits, local desired state wins (we push the diff);
  otherwise the server copy is adopted. Multi-device concurrent editing is out of scope.
- **UI:** offline banner + "Syncing…" indicator (`online` / `pendingSync` from the hook).
- **Still TODO:** PWA service worker so the app SHELL (code/assets) loads with no
  connection — currently offline works only after the app has been opened once online.

## Session plans (Plan tab, content layer) — 2026-10-08

The Plan tab started as a weekday→type schedule only. This adds the CONTENT of
each session type: which exercises, and per exercise a target sets × rep-range
(+ optional RPE).

- **Plan = per session TYPE** (Push/Pull/Legs/…), one to start. Decided to model
  as two tables (`plans` + `plan_exercises`) rather than a flat per-type table so
  **variants later** (Push A / Push B) are just extra `plans` rows — no schema
  change. `plans.name` defaults to 'Default' for now.
- **Order is deliberately NOT a plan concept.** Charlie can't plan exercise order
  — it depends on which machine is free at the gym. So a plan is an UNORDERED
  checklist; `plan_exercises.position` is editor display order only, never gym
  order. On Today the planned exercises show as a to-do list done in any order,
  each filling toward its target (e.g. "2/3 sets · 6–8").
- **Weight is NOT planned** — it auto-fills from last session (existing smart
  defaults, `lastWeight.js`). A plan prescribes sets × reps (+ optional RPE) so it
  tracks strength instead of going stale.
- **RPE included** per exercise (nullable): lets a plan encode heavy-vs-pump intent
  (e.g. 3×6–8 @8 vs 3×12–15) without a separate "block" field.
- **Beat-the-plan flag:** Today flags when a set hits the TOP of the rep-range at an
  RPE low enough to say "add weight next time" (progression nudge).
- **Migration 007** (`007_add_plans.sql`): owner-only RLS mirroring 005;
  plan_exercises inherit ownership through parent plan (like set_entries→workouts).
  Client-generated UUIDs per convention. Feature must degrade gracefully (localStorage)
  until Charlie runs the migration.
- **Plan sync = full durable outbox (revised).** Initially shipped with simple
  optimistic fire-and-forget sync; Charlie asked for zero data-loss risk, so it was
  upgraded to the same outbox as workouts: a separate persisted SYNCED BASELINE,
  `diffPlanOps` (pure, tested), debounced flush + flush-on-reconnect, and the
  adopt-server-unless-local-pending reconcile rule. Offline plan edits now survive a
  reload and sync when back online, with an amber offline/syncing banner in the editor.

## Weekly schedule moved to Supabase (synced, server-editable)

The weekday→type schedule (Plan tab) was `localStorage`-only, per-device
(`ScheduleProvider`). Charlie wanted it the same on every device and editable by
Hermes. Moved it server-side: a new `user_schedule` table (migration 008) holding
ONE row per user — a 7-slot JSON array indexed by JS `getDay()` (0=Sun..6=Sat),
each slot a WORKOUT_TYPES value or 'Rest'. Owner-only RLS, same one-row-per-user
pattern as `user_notes` (006).

- **Sync model = the full durable outbox** (Charlie's call), identical to
  plans/workouts: desired-state cache + a separate persisted SYNCED BASELINE,
  `schedulesEqual` (pure, tested) to detect a pending edit, debounced flush +
  flush-on-reconnect, and the adopt-server-unless-local-pending reconcile rule.
  Overkill for a single row, but keeps zero data-loss risk and one mental model.
- **Legacy migration:** `loadScheduleCache` falls back to the old global
  `lift-tracker:v1:schedule` key, and the baseline starts empty, so an existing
  local schedule counts as a pending edit and is pushed to the server (not lost).
  Cache keys are now user-namespaced like the others.
- **Server-editable:** `scripts/lift.py schedule show|set <day> <type>` reads/writes
  the row via service-role REST (`lift schedule set Mon Push`). The app doesn't
  live-sync, so a reload is needed to see a CLI change.
- Degrades gracefully until the migration is run: sync just fails and the schedule
  keeps working locally (amber "Syncing…" banner), then flushes once the table exists.
