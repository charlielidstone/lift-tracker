-- Migration 002: one workout per day (single-user phase).
-- Prevents duplicate workout rows for the same date if two "create" calls race.
-- Partial unique index on date where user_id is null (the current no-auth phase).
-- When auth lands (Phase 2), replace with a unique index on (user_id, date).
--
-- Run in Supabase SQL Editor.

create unique index if not exists workouts_one_per_day_noauth
  on public.workouts (date)
  where user_id is null;
