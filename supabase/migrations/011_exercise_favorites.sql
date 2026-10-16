-- Migration 011: exercise favourites + library expansion.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Three parts, in order:
--   1. exercise_favorites table (one row per user+exercise), owner-only RLS.
--   2. Favourite EVERY exercise that exists RIGHT NOW for Charlie — so the current
--      library all starts favourited. (Must run BEFORE part 3 so the new staples
--      below are NOT auto-favourited.)
--   3. Add 60 common built-in exercises (user_id stamped so they're visible under
--      RLS; is_custom=false). These are intentionally NOT favourited.

-- ── 1. exercise_favorites ────────────────────────────────────
create table if not exists public.exercise_favorites (
  user_id      uuid not null references auth.users (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercise_favorites enable row level security;

create policy "own_favorites_select" on public.exercise_favorites
  for select using (auth.uid() = user_id);
create policy "own_favorites_insert" on public.exercise_favorites
  for insert with check (auth.uid() = user_id);
create policy "own_favorites_delete" on public.exercise_favorites
  for delete using (auth.uid() = user_id);

-- ── 2. Favourite the existing library (pre-expansion) ─────────
insert into public.exercise_favorites (user_id, exercise_id)
select user_id, id
  from public.exercises
 where user_id = '3797dfb9-897c-475b-8431-2dd1e464853e'
on conflict do nothing;

-- ── 3. Library expansion: 60 common built-in exercises ───────
-- Guard against duplicate names (also protects future CLI adds). Current library
-- names are unique, so this index creates cleanly.
create unique index if not exists exercises_user_name_idx
  on public.exercises (user_id, lower(name));

insert into public.exercises (name, muscle_group, is_custom, user_id) values
  ('Dumbbell Fly', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Cable Fly', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Decline Bench Press', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Push-up', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Chest Dip', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Close Grip Bench Press', 'chest', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Deadlift', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Barbell Row', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Pull-up', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Chin-up', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('T-Bar Row', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Chest Supported Row', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Straight Arm Pulldown', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Wide Grip Lat Pulldown', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('One Arm Dumbbell Row', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Inverted Row', 'back', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Back Squat', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Front Squat', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Romanian Deadlift', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Bulgarian Split Squat', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Goblet Squat', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Hack Squat', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Walking Lunge', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Leg Curl', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Good Morning', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Step-up', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Glute Bridge', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Sumo Deadlift', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Calf Raise', 'legs', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Overhead Press', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Arnold Press', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Seated Dumbbell Press', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Front Raise', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Machine Lateral Raise', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Face Pull', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Rear Delt Fly', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Upright Row', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Shrug', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Reverse Pec Deck', 'shoulders', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Bicep Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Hammer Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Tricep Pushdown', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('EZ Bar Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Concentration Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Cable Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Rope Tricep Pushdown', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Skull Crusher', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Tricep Kickback', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Bench Dip', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Wrist Curl', 'arms', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Plank', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Crunch', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Hanging Leg Raise', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Russian Twist', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Cable Crunch', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Bicycle Crunch', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Ab Wheel', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Hanging Knee Raise', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Side Plank', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e'),
  ('Back Extension', 'core', false, '3797dfb9-897c-475b-8431-2dd1e464853e')
on conflict (user_id, lower(name)) do nothing;
