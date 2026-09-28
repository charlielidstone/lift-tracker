-- Migration 003: workout type/label (Push, Pull, Legs, Upper, Lower, Full body).
-- Lets Charlie categorize workouts so history is scannable and same-type
-- comparisons are possible later. Free-text column constrained by the app to a
-- fixed set (see src/lib/defaults.js WORKOUT_TYPES); nullable (unlabeled allowed).
--
-- Run in Supabase SQL Editor.

alter table public.workouts add column if not exists type text;
