-- Migration 007: session plans (templates per workout type).
-- A "plan" is the CONTENT of a session type (Push/Pull/Legs/…): which exercises,
-- and for each one a target sets × rep-range (+ optional RPE). Run in the Supabase
-- SQL Editor. Owner-only RLS, matching migration 005's per-user pattern.
--
-- Design notes:
--   • One plan per type to start (name defaults to 'Default'). Variants later =
--     additional rows per type (e.g. 'Push A' / 'Push B') — no schema change.
--   • plan_exercises.position is a STABLE EDITOR order only. It is NOT the gym
--     order: at the gym exercises are done in whatever order a machine is free.
--     The app treats a plan as an unordered checklist; position just keeps the
--     editor list from reshuffling.
--   • Weight is intentionally NOT planned — it auto-fills from last session's
--     history (smart defaults). A plan prescribes sets × reps (+ optional RPE).

create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null,                    -- a WORKOUT_TYPES value (Push/Pull/…)
  name        text not null default 'Default',  -- for future variants
  created_at  timestamptz not null default now(),
  unique (user_id, type, name)
);

create table if not exists public.plan_exercises (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  target_sets  integer not null default 3,
  rep_min      integer not null default 8,
  rep_max      integer not null default 12,
  target_rpe   numeric,                          -- nullable: optional per-exercise RPE
  position     integer not null default 0,       -- editor display order only (see notes)
  created_at   timestamptz not null default now(),
  unique (plan_id, exercise_id)
);

create index if not exists plan_exercises_plan_idx on public.plan_exercises (plan_id);
create index if not exists plans_user_type_idx on public.plans (user_id, type);

-- ── RLS: owner-only, mirroring migration 005 ──────────────────────────────
alter table public.plans enable row level security;

create policy "own_plans_select" on public.plans
  for select using (auth.uid() = user_id);
create policy "own_plans_insert" on public.plans
  for insert with check (auth.uid() = user_id);
create policy "own_plans_update" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_plans_delete" on public.plans
  for delete using (auth.uid() = user_id);

-- plan_exercises inherit ownership through the parent plan (like set_entries→workouts).
alter table public.plan_exercises enable row level security;

create policy "own_plan_exercises_select" on public.plan_exercises
  for select using (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  );
create policy "own_plan_exercises_insert" on public.plan_exercises
  for insert with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  );
create policy "own_plan_exercises_update" on public.plan_exercises
  for update using (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  );
create policy "own_plan_exercises_delete" on public.plan_exercises
  for delete using (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  );
