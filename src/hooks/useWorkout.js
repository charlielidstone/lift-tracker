// useWorkout — owns today's workout state and persists it to Supabase.
//
// Persistence strategy: the client generates UUIDs for every set, and we insert
// those same ids into the DB (see workoutRepo.insertSet). Local state and DB rows
// therefore share one id space, so auto-save is a plain DIFF of the current sets
// against the last-saved snapshot — no optimistic-id reconciliation needed.
//
// Auto-save is debounced (DECISIONS: auto-save every change, but don't hammer the
// DB on every +5 lb tap). Writes are fire-and-forget with error logging; the UI
// stays optimistic and responsive.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SET } from '@/lib/defaults';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  deleteExerciseSets,
  deleteSet,
  fetchExercises,
  getOrCreateTodayWorkout,
  insertSet,
  setWorkoutFinished as persistWorkoutFinished,
  setWorkoutType as persistWorkoutType,
  updateSet,
} from '@/lib/workoutRepo';

const SAVE_DEBOUNCE_MS = 700;
const newSet = () => ({ id: crypto.randomUUID(), ...DEFAULT_SET });

// Flatten UI exercises → a map of setId → the row we'd persist.
function snapshotSets(exercises) {
  const map = new Map();
  for (const ex of exercises) {
    ex.sets.forEach((set, i) => {
      map.set(set.id, {
        id: set.id,
        exerciseId: ex.exerciseId,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe ?? null,
        setOrder: i,
      });
    });
  }
  return map;
}

function rowChanged(a, b) {
  return (
    a.weight !== b.weight ||
    a.reps !== b.reps ||
    a.rpe !== b.rpe ||
    a.setOrder !== b.setOrder ||
    a.exerciseId !== b.exerciseId
  );
}

export function useWorkout() {
  const [exercises, setExercises] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [library, setLibrary] = useState([]);
  const [type, setWorkoutTypeState] = useState(null);
  const [finished, setFinishedState] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const workoutIdRef = useRef(null);
  const savedRef = useRef(new Map()); // setId → last-persisted row
  const timerRef = useRef(null);

  // ── Initial load: exercise library + today's workout ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const [lib, workout] = await Promise.all([fetchExercises(), getOrCreateTodayWorkout()]);
        if (cancelled) return;
        setLibrary(lib);
        workoutIdRef.current = workout.id;
        setWorkoutTypeState(workout.type ?? null);
        setFinishedState(Boolean(workout.finished_at));
        setExercises(workout.exercises);
        savedRef.current = snapshotSets(workout.exercises);
      } catch (e) {
        if (!cancelled) setError(e);
        console.error('[useWorkout] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Diff current sets against the saved snapshot and persist deltas ──
  const flush = useCallback(async () => {
    if (!isSupabaseConfigured || !workoutIdRef.current) return;
    const workoutId = workoutIdRef.current;
    const desired = snapshotSets(exercises);
    const saved = savedRef.current;
    const ops = [];

    for (const [id, row] of desired) {
      const prev = saved.get(id);
      if (!prev) {
        ops.push(insertSet({ ...row, workoutId }));
      } else if (rowChanged(prev, row)) {
        ops.push(
          updateSet(id, {
            weight: row.weight,
            reps: row.reps,
            rpe: row.rpe,
            set_order: row.setOrder,
          }),
        );
      }
    }
    // Deletions: individual set removed vs. whole exercise removed.
    const survivingExercises = new Set(exercises.map((e) => e.exerciseId));
    const handledExercises = new Set();
    for (const [id, row] of saved) {
      if (desired.has(id)) continue;
      if (!survivingExercises.has(row.exerciseId)) {
        // whole exercise gone — one bulk delete per exercise
        if (!handledExercises.has(row.exerciseId)) {
          handledExercises.add(row.exerciseId);
          ops.push(deleteExerciseSets(workoutId, row.exerciseId));
        }
      } else {
        ops.push(deleteSet(id));
      }
    }

    if (ops.length === 0) return;
    try {
      await Promise.all(ops);
      savedRef.current = desired; // commit snapshot only after writes succeed
    } catch (e) {
      setError(e);
      console.error('[useWorkout] save failed', e);
    }
  }, [exercises]);

  // Debounced auto-save whenever exercises change.
  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [exercises, flush, loading]);

  // ── Mutations (optimistic; persistence happens via the effect above) ──
  const addExercise = useCallback((libraryExercise) => {
    const entry = {
      id: crypto.randomUUID(),
      exerciseId: libraryExercise.id,
      name: libraryExercise.name,
      sets: [newSet()], // zero-tap logged set (design philosophy)
    };
    setExercises((prev) => [...prev, entry]);
    setExpandedId(entry.id);
  }, []);

  const updateExercise = useCallback((id, next) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? next : e)));
  }, []);

  const removeExercise = useCallback((id) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  const toggle = useCallback((id) => setExpandedId((cur) => (cur === id ? null : id)), []);

  // Workout type label (Push/Pull/…). Optimistic + persisted immediately.
  const setType = useCallback((nextType) => {
    setWorkoutTypeState(nextType);
    if (workoutIdRef.current) {
      persistWorkoutType(workoutIdRef.current, nextType).catch((e) => {
        setError(e);
        console.error('[useWorkout] setType failed', e);
      });
    }
  }, []);

  // Finish (lock) or unlock the workout. Optimistic + persisted immediately.
  const setFinished = useCallback((next) => {
    setFinishedState(next);
    if (workoutIdRef.current) {
      persistWorkoutFinished(workoutIdRef.current, next).catch((e) => {
        setError(e);
        console.error('[useWorkout] setFinished failed', e);
      });
    }
  }, []);

  return {
    exercises,
    expandedId,
    library,
    loading,
    error,
    type,
    setType,
    finished,
    setFinished,
    addExercise,
    updateExercise,
    removeExercise,
    toggle,
  };
}
