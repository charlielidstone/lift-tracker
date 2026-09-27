-- Lift Tracker — Supabase schema (v1)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Design notes:
--  * Mirrors docs/DECISIONS.md data model: exercises / workouts / set_entries.
--  * AUTH-READY but auth-DEFERRED: user_id columns exist and reference auth.users,
--    but are nullable for the current single-user, no-login phase.
--  * Weight stored in the canonical unit: POUNDS (lb). kg is display-only (STANDARDS.md).
--  * est_1rm is NOT stored — computed on read in the app (lib/oneRepMax.js).

-- ─────────────────────────────────────────────────────────────
-- exercises: the library (seeded + user-added custom entries)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  muscle_group  text,
  is_custom     boolean not null default false,
  user_id       uuid references auth.users (id) on delete cascade,  -- null = built-in/shared
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- workouts: one training session
-- ─────────────────────────────────────────────────────────────
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  date        date not null default current_date,
  name        text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- set_entries: one logged set within a workout
-- ─────────────────────────────────────────────────────────────
create table if not exists public.set_entries (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  weight       numeric not null,   -- pounds (canonical)
  reps         integer not null,
  rpe          numeric,
  set_order    integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists set_entries_workout_idx on public.set_entries (workout_id);
create index if not exists set_entries_exercise_idx on public.set_entries (exercise_id);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date desc);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security
-- PHASE 1 (now, no auth): permissive — anyone with the anon key can read/write.
--   Acceptable for a private personal app in development. DO NOT store sensitive
--   data until Phase 2 auth is enabled.
-- PHASE 2 (when login lands): replace the permissive policies with owner checks,
--   e.g.  using (auth.uid() = user_id)  with check (auth.uid() = user_id).
-- ─────────────────────────────────────────────────────────────
alter table public.exercises   enable row level security;
alter table public.workouts    enable row level security;
alter table public.set_entries enable row level security;

-- Phase 1 permissive policies (named so they're easy to DROP in Phase 2).
create policy "phase1_all_exercises"   on public.exercises   for all using (true) with check (true);
create policy "phase1_all_workouts"    on public.workouts    for all using (true) with check (true);
create policy "phase1_all_set_entries" on public.set_entries for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Seed the exercise library (built-in, user_id null)
-- ─────────────────────────────────────────────────────────────
insert into public.exercises (name, muscle_group, is_custom) values
  ('Bench Press',     'chest',      false),
  ('Back Squat',      'legs',       false),
  ('Deadlift',        'back',       false),
  ('Overhead Press',  'shoulders',  false),
  ('Barbell Row',     'back',       false),
  ('Pull-up',         'back',       false),
  ('Bicep Curl',      'arms',       false),
  ('Incline Bench Press', 'chest',  false),
  ('Romanian Deadlift',   'legs',   false),
  ('Lat Pulldown',    'back',       false),
  ('Leg Press',       'legs',       false),
  ('Tricep Pushdown', 'arms',       false)
on conflict do nothing;
