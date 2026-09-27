-- Migration 004: workout finish/lock.
-- finished_at marks a workout as done → the app renders it read-only so sets can't
-- be edited by accident. null = still editable. Unlocking sets it back to null.
--
-- Run in Supabase SQL Editor.

alter table public.workouts add column if not exists finished_at timestamptz;
