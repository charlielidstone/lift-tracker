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
import { DEFAULT_SET, localToday } from '@/lib/defaults';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  loadLibraryCache,
  loadWorkoutCache,
  saveLibraryCache,
  saveWorkoutCache,
} from '@/lib/localCache';
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = localToday();

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
  const hydratedRef = useRef(false); // cache hydration done → cache writes allowed

  // ── Initial load: cache first (instant, offline-safe), then server ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    // 1. Synchronous hydrate from localStorage so a reload — even offline —
    //    shows the workout immediately without waiting on the network.
    //    (setState-in-effect is intentional: syncing from an external store.)
    /* eslint-disable react/set-state-in-effect */
    const cachedLib = loadLibraryCache(userId);
    const cachedWorkout = loadWorkoutCache(userId, today);
    if (cachedLib) setLibrary(cachedLib);
    if (cachedWorkout) {
      workoutIdRef.current = cachedWorkout.workoutId ?? null;
      setWorkoutTypeState(cachedWorkout.type ?? null);
      setFinishedState(Boolean(cachedWorkout.finished));
      setExercises(cachedWorkout.exercises ?? []);
      savedRef.current = snapshotSets(cachedWorkout.exercises ?? []);
      setLoading(false); // we have something to show; server will reconcile
    }
    /* eslint-enable react/set-state-in-effect */
    hydratedRef.current = true;

    // 2. Reconcile with the server (authoritative when online).
    (async () => {
      try {
        const [lib, workout] = await Promise.all([fetchExercises(), getOrCreateTodayWorkout()]);
        if (cancelled) return;
        setLibrary(lib);
        saveLibraryCache(userId, lib);
        workoutIdRef.current = workout.id;
        setWorkoutTypeState(workout.type ?? null);
        setFinishedState(Boolean(workout.finished_at));
        setExercises(workout.exercises);
        savedRef.current = snapshotSets(workout.exercises);
      } catch (e) {
        // Offline / server unreachable: keep the cached view, don't surface a
        // hard error if we already have something on screen.
        if (cancelled) return;
        if (!cachedWorkout) setError(e);
        console.error('[useWorkout] server load failed (using cache)', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, today]);

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

  // Write-through cache: mirror current state to localStorage on every change so
  // an offline reload restores exactly what's on screen (independent of the debounced
  // server flush above). Cheap + synchronous; runs only after hydration.
  useEffect(() => {
    if (!isSupabaseConfigured || !hydratedRef.current) return;
    saveWorkoutCache(userId, today, {
      workoutId: workoutIdRef.current,
      type,
      finished,
      exercises,
    });
  }, [exercises, type, finished, userId, today]);

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
