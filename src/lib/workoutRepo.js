// Data access layer for workouts. The ONLY module that talks to Supabase for
// workout data — components call these, never the client directly (see architecture).
//
// Shapes match the in-memory UI model:
//   exercise entry: { id, exerciseId, name, sets: [{ id, weight, reps, rpe }] }
//   workout:        { id, date, exercises: [ exercise entry, ... ] }
//
// DB layout (see supabase/schema.sql): workouts 1—* set_entries *—1 exercises.
// The UI groups set_entries by exercise; these helpers translate both ways.

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// ── Exercise library ─────────────────────────────────────────
export async function fetchExercises() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, is_custom')
    .order('name');
  if (error) throw error;
  return data;
}

// ── Workouts ─────────────────────────────────────────────────

// Get (or create) today's workout, with its sets grouped into exercise entries.
// Guards against concurrent callers (e.g. React StrictMode's double-invoked effect)
// by sharing a single in-flight promise — otherwise two "create" calls race and
// produce duplicate workout rows for the same day.
let todayWorkoutPromise = null;

export async function getOrCreateTodayWorkout() {
  if (!isSupabaseConfigured) return null;
  if (todayWorkoutPromise) return todayWorkoutPromise;
  todayWorkoutPromise = _getOrCreateTodayWorkout().finally(() => {
    todayWorkoutPromise = null;
  });
  return todayWorkoutPromise;
}

async function _getOrCreateTodayWorkout() {
  const today = new Date().toISOString().slice(0, 10);

  let { data: workout, error } = await supabase
    .from('workouts')
    .select('id, date, name, notes')
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!workout) {
    const inserted = await supabase
      .from('workouts')
      .insert({ date: today })
      .select('id, date, name, notes')
      .single();
    if (inserted.error) throw inserted.error;
    workout = inserted.data;
  }

  const exercises = await fetchWorkoutExercises(workout.id);
  return { ...workout, exercises };
}

// Load a workout's set_entries and group them into exercise entries (UI shape).
export async function fetchWorkoutExercises(workoutId) {
  const { data, error } = await supabase
    .from('set_entries')
    .select('id, weight, reps, rpe, set_order, exercise_id, exercises(name)')
    .eq('workout_id', workoutId)
    .order('set_order');
  if (error) throw error;

  const byExercise = new Map();
  for (const row of data) {
    if (!byExercise.has(row.exercise_id)) {
      byExercise.set(row.exercise_id, {
        id: row.exercise_id, // group key; a workout shows each exercise once
        exerciseId: row.exercise_id,
        name: row.exercises?.name ?? 'Exercise',
        sets: [],
      });
    }
    byExercise.get(row.exercise_id).sets.push({
      id: row.id,
      weight: Number(row.weight),
      reps: row.reps,
      rpe: row.rpe == null ? null : Number(row.rpe),
    });
  }
  return [...byExercise.values()];
}

// ── Set entries (the auto-saved unit) ────────────────────────

export async function insertSet({ id, workoutId, exerciseId, weight, reps, rpe, setOrder }) {
  const { data, error } = await supabase
    .from('set_entries')
    .insert({
      id, // client-generated UUID so local state and DB row share one id
      workout_id: workoutId,
      exercise_id: exerciseId,
      weight,
      reps,
      rpe,
      set_order: setOrder ?? 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSet(setId, patch) {
  const { error } = await supabase.from('set_entries').update(patch).eq('id', setId);
  if (error) throw error;
}

export async function deleteSet(setId) {
  const { error } = await supabase.from('set_entries').delete().eq('id', setId);
  if (error) throw error;
}

// Remove an exercise from a workout = delete all its set_entries for that workout.
export async function deleteExerciseSets(workoutId, exerciseId) {
  const { error } = await supabase
    .from('set_entries')
    .delete()
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId);
  if (error) throw error;
}
