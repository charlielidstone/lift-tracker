// planRepo — the ONLY module that talks to Supabase for session plans.
// A "plan" is the content of a workout TYPE: which exercises, and per exercise a
// target sets × rep-range (+ optional RPE). See docs/DECISIONS.md "Session plans".
//
// UI shape (what the provider/components consume):
//   plan:         { id, type, name, exercises: [ planExercise, ... ] }
//   planExercise: { id, exerciseId, name, muscleGroup, targetSets, repMin, repMax,
//                   rpe, position }
//
// DB layout (migration 007): plans 1—* plan_exercises *—1 exercises.
// Order is NOT meaningful at the gym — `position` is editor display order only.

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// The current logged-in user's id, or null (single-user dev mode). New rows are
// stamped with it so they're owned once RLS is enforced. Mirrors workoutRepo.
async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

function toUiExercise(row) {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    name: row.exercises?.name ?? 'Exercise',
    muscleGroup: row.exercises?.muscle_group ?? null,
    targetSets: row.target_sets,
    repMin: row.rep_min,
    repMax: row.rep_max,
    rpe: row.target_rpe == null ? null : Number(row.target_rpe),
    position: row.position,
  };
}

// Fetch every plan for the current user, each with its exercises (editor order).
export async function fetchPlans() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('plans')
    .select(
      'id, type, name, plan_exercises(id, exercise_id, target_sets, rep_min, rep_max, target_rpe, position, exercises(name, muscle_group))',
    )
    .order('type');
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    exercises: (p.plan_exercises ?? [])
      .map(toUiExercise)
      .sort((a, b) => a.position - b.position),
  }));
}

// Create a plan row for a type (name defaults to 'Default' — one-per-type v1).
// Client-generates the id so local state and the DB row share it. Returns the row.
export async function createPlan({ id, type, name = 'Default' }) {
  if (!isSupabaseConfigured) throw new Error('not configured');
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('plans')
    .insert({ id, type, name, ...(uid ? { user_id: uid } : {}) })
    .select('id, type, name')
    .single();
  if (error) throw error;
  return data;
}

export async function insertPlanExercise({
  id,
  planId,
  exerciseId,
  targetSets,
  repMin,
  repMax,
  rpe,
  position,
}) {
  if (!isSupabaseConfigured) throw new Error('not configured');
  const { error } = await supabase.from('plan_exercises').insert({
    id,
    plan_id: planId,
    exercise_id: exerciseId,
    target_sets: targetSets,
    rep_min: repMin,
    rep_max: repMax,
    target_rpe: rpe,
    position,
  });
  if (error) throw error;
}

// Patch keys are DB column names: target_sets, rep_min, rep_max, target_rpe, position.
export async function updatePlanExercise(id, patch) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('plan_exercises').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePlanExercise(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('plan_exercises').delete().eq('id', id);
  if (error) throw error;
}
