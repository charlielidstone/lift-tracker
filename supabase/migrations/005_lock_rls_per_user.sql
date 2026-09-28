-- Migration 005: lock RLS to per-user (Phase 2 auth).
-- Prereq: every existing row already claimed to a user_id (done via service_role).
-- Run in Supabase SQL Editor.
--
-- exercises / workouts: owner = user_id column.
-- set_entries: no user_id → owner is inherited from its parent workout.
-- Signup policy: OPEN (anyone can create an account); each user sees only their own data.

-- ── Drop the permissive Phase-1 policies ─────────────────────
drop policy if exists "phase1_all_exercises"   on public.exercises;
drop policy if exists "phase1_all_workouts"    on public.workouts;
drop policy if exists "phase1_all_set_entries" on public.set_entries;

-- ── exercises: owner-only ────────────────────────────────────
create policy "own_exercises_select" on public.exercises
  for select using (auth.uid() = user_id);
create policy "own_exercises_insert" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "own_exercises_update" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_exercises_delete" on public.exercises
  for delete using (auth.uid() = user_id);

-- ── workouts: owner-only ─────────────────────────────────────
create policy "own_workouts_select" on public.workouts
  for select using (auth.uid() = user_id);
create policy "own_workouts_insert" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "own_workouts_update" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_workouts_delete" on public.workouts
  for delete using (auth.uid() = user_id);

-- ── set_entries: owned via parent workout ────────────────────
create policy "own_set_entries_select" on public.set_entries
  for select using (
    exists (select 1 from public.workouts w
            where w.id = set_entries.workout_id and w.user_id = auth.uid())
  );
create policy "own_set_entries_insert" on public.set_entries
  for insert with check (
    exists (select 1 from public.workouts w
            where w.id = set_entries.workout_id and w.user_id = auth.uid())
  );
create policy "own_set_entries_update" on public.set_entries
  for update using (
    exists (select 1 from public.workouts w
            where w.id = set_entries.workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workouts w
            where w.id = set_entries.workout_id and w.user_id = auth.uid())
  );
create policy "own_set_entries_delete" on public.set_entries
  for delete using (
    exists (select 1 from public.workouts w
            where w.id = set_entries.workout_id and w.user_id = auth.uid())
  );
