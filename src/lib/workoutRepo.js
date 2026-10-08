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
import { localToday } from '@/lib/defaults';

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

// Create a new library exercise owned by the current user. Returns the new row.
// Caller should dedupe by name first (case-insensitive) — see useWorkout.createExercise.
export async function insertExercise({ name, muscleGroup }) {
  if (!isSupabaseConfigured) throw new Error('not configured');
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: name.trim(),
      muscle_group: muscleGroup?.trim() || null,
      is_custom: true,
      ...(uid ? { user_id: uid } : {}),
    })
    .select('id, name, muscle_group, is_custom')
    .single();
  if (error) throw error;
  return data;
}

// ── Workouts ─────────────────────────────────────────────────

// The current logged-in user's id, or null when not authenticated (single-user
// dev mode). New rows are stamped with this so they're owned once RLS is locked.
async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

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
  const today = localToday();

  let { data: workout, error } = await supabase
    .from('workouts')
    .select('id, date, name, notes, type, finished_at')
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!workout) {
    const uid = await currentUserId();
    const inserted = await supabase
      .from('workouts')
      .insert(uid ? { date: today, user_id: uid } : { date: today })
      .select('id, date, name, notes, type, finished_at')
      .single();
    if (inserted.error) throw inserted.error;
    workout = inserted.data;
  }

  const exercises = await fetchWorkoutExercises(workout.id);
  return { ...workout, exercises };
}

// Load a workout's set_entries and group them into exercise entries (UI shape).
// Exercises are ordered by creation (the earliest-created set of each exercise
// fixes its position) → newest exercise at the bottom, stable across reloads.
// Sets within an exercise are ordered by set_order.
export async function fetchWorkoutExercises(workoutId) {
  const { data, error } = await supabase
    .from('set_entries')
    .select('id, weight, reps, rpe, set_order, created_at, exercise_id, exercises(name)')
    .eq('workout_id', workoutId)
    .order('created_at');
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
      setOrder: row.set_order,
    });
  }
  // Order sets within each exercise by set_order (creation order groups exercises,
  // but sets should read in their logged order).
  const exercises = [...byExercise.values()];
  for (const ex of exercises) {
    ex.sets.sort((a, b) => a.setOrder - b.setOrder);
    ex.sets.forEach((s) => delete s.setOrder);
  }
  return exercises;
}

// Load recent workouts (newest first), each with its sets grouped into exercise
// entries (same UI shape as fetchWorkoutExercises). Read-only history view.
export async function fetchWorkoutHistory(limit = 30) {
  if (!isSupabaseConfigured) return [];
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, date, name, type')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const withExercises = await Promise.all(
    workouts.map(async (workout) => ({
      ...workout,
      exercises: await fetchWorkoutExercises(workout.id),
    })),
  );
  return withExercises;
}

// Set (or clear) a workout's type label. Pass null to clear.
export async function setWorkoutType(workoutId, type) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('workouts')
    .update({ type })
    .eq('id', workoutId);
  if (error) throw error;
}

// Apply a diff (from workoutEdit.diffWorkout) to a workout: type change, set
// updates, deletes, and inserts. Used by the History edit screen. Inserts run
// first so a replaced set exists before anything references it; order otherwise
// doesn't matter (each op is independent by id).
export async function applyWorkoutEdits(workoutId, diff) {
  if (!isSupabaseConfigured) return;
  if (diff.type.changed) await setWorkoutType(workoutId, diff.type.value);
  for (const ins of diff.inserts) {
    await insertSet({
      id: ins.id,
      workoutId,
      exerciseId: ins.exerciseId,
      weight: ins.weight,
      reps: ins.reps,
      rpe: ins.rpe,
      setOrder: ins.setOrder,
    });
  }
  for (const u of diff.updates) await updateSet(u.id, u.patch);
  for (const id of diff.deletes) await deleteSet(id);
}

// Mark a workout finished (locked) or unfinished (editable). finished=true stamps
// finished_at with now; false clears it.
export async function setWorkoutFinished(workoutId, finished) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('workouts')
    .update({ finished_at: finished ? new Date().toISOString() : null })
    .eq('id', workoutId);
  if (error) throw error;
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

// ── Notes scratchpad (one free-text row per user) ────────────
// Returns { content, updatedAt } or null when there's no note yet.
export async function fetchNote() {
  if (!isSupabaseConfigured) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_notes')
    .select('content, updated_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? { content: data.content ?? '', updatedAt: data.updated_at } : null;
}

// Upsert the user's note. updatedAt is set server-side (ISO now) so other
// devices can resolve which copy is newer.
export async function saveNote(content) {
  if (!isSupabaseConfigured) return;
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('user_notes')
    .upsert({ user_id: uid, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
