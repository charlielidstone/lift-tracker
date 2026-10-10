-- Migration 008: per-user weekly training schedule.
-- The weekday→type grid (Plan tab) was localStorage-only (per-device). This moves
-- it server-side so it syncs across devices AND can be read/edited over the API
-- (scripts/lift.py). One row per user holding a 7-slot JSON array indexed by JS
-- getDay() (0=Sun … 6=Sat), each slot a WORKOUT_TYPES value or 'Rest'.
-- Owner-only RLS, matching migration 006's one-row-per-user pattern. Run in the
-- Supabase SQL Editor.

create table if not exists public.user_schedule (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  schedule    jsonb not null default '["Rest","Rest","Rest","Rest","Rest","Rest","Rest"]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_schedule enable row level security;

-- Owner-only: a user sees and edits only their own schedule row.
create policy "own_user_schedule_select" on public.user_schedule
  for select using (auth.uid() = user_id);
create policy "own_user_schedule_insert" on public.user_schedule
  for insert with check (auth.uid() = user_id);
create policy "own_user_schedule_update" on public.user_schedule
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_user_schedule_delete" on public.user_schedule
  for delete using (auth.uid() = user_id);
