// scheduleRepo — the ONLY module that talks to Supabase for the weekly schedule.
// A schedule is a single 7-slot array per user (one row in user_schedule,
// migration 008): index = JS getDay() (0=Sun … 6=Sat), each slot a WORKOUT_TYPES
// value or 'Rest'. Mirrors the notes repo (one free-text row per user) — the
// schedule is a lightweight per-user template.

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { normalizeSchedule } from '@/lib/schedule';

// The current logged-in user's id, or null. New rows are stamped with it so
// they're owned under RLS. Mirrors planRepo/workoutRepo.
async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// Fetch the user's schedule as a normalized 7-slot array, or null when they have
// no schedule row yet (so the caller can keep a local/legacy copy).
export async function fetchSchedule() {
  if (!isSupabaseConfigured) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_schedule')
    .select('schedule')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeSchedule(data.schedule) : null;
}

// Upsert the user's schedule. updated_at is stamped so other devices can tell
// which copy is newer. One row per user (onConflict user_id).
export async function saveSchedule(schedule) {
  if (!isSupabaseConfigured) return;
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('user_schedule')
    .upsert(
      {
        user_id: uid,
        schedule: normalizeSchedule(schedule),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}
