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
  loadSyncedSnapshot,
  loadWorkoutCache,
  saveLibraryCache,
  saveSyncedSnapshot,
  saveWorkoutCache,
} from '@/lib/localCache';
import { diffOps, hasPendingOps, mapToRows, rowsToMap, snapshotSets } from '@/lib/syncDiff';
import {
  deleteExerciseSets,
  deleteSet,
  fetchExercises,
  getOrCreateTodayWorkout,
  insertExercise,
  insertSet,
  setWorkoutFinished as persistWorkoutFinished,
  setWorkoutType as persistWorkoutType,
  updateSet,
} from '@/lib/workoutRepo';

const SAVE_DEBOUNCE_MS = 700;
const newSet = () => ({ id: crypto.randomUUID(), ...DEFAULT_SET });

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
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingSync, setPendingSync] = useState(false);

  const workoutIdRef = useRef(null);
  const savedRef = useRef(new Map()); // setId → last-SERVER-CONFIRMED row
  const timerRef = useRef(null);
  const hydratedRef = useRef(false); // cache hydration done → cache writes allowed
  const exercisesRef = useRef(exercises); // latest exercises for reconnect flush
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  // Persist savedRef both in memory and to localStorage so the outbox baseline
  // survives an offline reload (else local edits look already-saved and get lost).
  const commitSynced = useCallback(
    (map) => {
      savedRef.current = map;
      saveSyncedSnapshot(userId, today, mapToRows(map));
    },
    [userId, today],
  );

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
    const cachedSynced = loadSyncedSnapshot(userId, today);
    if (cachedLib) setLibrary(cachedLib);
    if (cachedWorkout) {
      workoutIdRef.current = cachedWorkout.workoutId ?? null;
      setWorkoutTypeState(cachedWorkout.type ?? null);
      setFinishedState(Boolean(cachedWorkout.finished));
      setExercises(cachedWorkout.exercises ?? []);
      // Baseline = last server-confirmed snapshot (NOT the desired state), so any
      // edits made offline are still detected as pending after this reload.
      savedRef.current = cachedSynced
        ? rowsToMap(cachedSynced)
        : snapshotSets(cachedWorkout.exercises ?? []);
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
        // Adopt the server copy UNLESS there are genuine un-synced LOCAL edits.
        // "Local edits" = cached desired state differs from the last-synced
        // baseline (savedRef) — NOT from the server. Comparing against the server
        // would wrongly treat an out-of-band server change (e.g. a CLI/admin edit)
        // as a local edit and freeze the stale cache. When there are no pending
        // local edits, the server always wins.
        const serverSnap = snapshotSets(workout.exercises);
        const localEdits = cachedWorkout
          ? hasPendingOps(snapshotSets(cachedWorkout.exercises ?? []), savedRef.current)
          : false;
        if (!localEdits) {
          setExercises(workout.exercises);
        }
        commitSynced(serverSnap);
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
  }, [userId, today, commitSynced]);

  // ── Flush pending ops to the server (used by debounce + reconnect) ──
  // Reads exercises from a ref so a single stable callback can be triggered by
  // the reconnect listener without stale closures.
  const flush = useCallback(async () => {
    if (!isSupabaseConfigured || !workoutIdRef.current) return;
    const workoutId = workoutIdRef.current;
    const desired = snapshotSets(exercisesRef.current);
    const saved = savedRef.current;
    const { inserts, updates, setDeletes, exerciseDeletes } = diffOps(desired, saved);

    const ops = [
      ...inserts.map((row) => insertSet({ ...row, workoutId })),
      ...updates.map((row) =>
        updateSet(row.id, {
          weight: row.weight,
          reps: row.reps,
          rpe: row.rpe,
          set_order: row.setOrder,
        }),
      ),
      ...exerciseDeletes.map((exerciseId) => deleteExerciseSets(workoutId, exerciseId)),
      ...setDeletes.map((id) => deleteSet(id)),
    ];

    if (ops.length === 0) {
      setPendingSync(false);
      return;
    }
    try {
      await Promise.all(ops);
      commitSynced(desired); // baseline advances only after writes succeed
      setPendingSync(false);
      setError(null);
    } catch (e) {
      // Offline / server error: keep the pending flag so the reconnect listener
      // (and next edit) retries. Edits are safe in the write-through cache.
      setPendingSync(true);
      console.error('[useWorkout] save failed (will retry)', e);
    }
  }, [commitSynced]);

  // Debounced auto-save whenever exercises change.
  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    setPendingSync(hasPendingOps(snapshotSets(exercises), savedRef.current));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [exercises, flush, loading]);

  // ── Online/offline: reflect status and flush the outbox on reconnect ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => {
      setOnline(true);
      flush(); // drain any edits made while offline
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

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
  // Add a library exercise to today. If it's already in the workout, just expand
  // it instead of adding a duplicate card.
  const addExercise = useCallback((libraryExercise) => {
    const exId = libraryExercise.id ?? libraryExercise.exerciseId;
    let targetId = null;
    setExercises((prev) => {
      const existing = prev.find((e) => e.exerciseId === exId);
      if (existing) {
        targetId = existing.id;
        return prev; // no dupe
      }
      const entry = {
        id: crypto.randomUUID(),
        exerciseId: exId,
        name: libraryExercise.name,
        sets: [newSet()], // zero-tap logged set (design philosophy)
      };
      targetId = entry.id;
      return [...prev, entry];
    });
    if (targetId) setExpandedId(targetId);
  }, []);

  // Create a brand-new library exercise, then add it to today. Case-insensitive
  // dedupe against the existing library (reuses the match instead of duplicating).
  // Returns the library row used. Online-only (needs the DB to mint the id).
  const createExercise = useCallback(
    async ({ name, muscleGroup }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name required');
      const existing = library.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
      const row = existing ?? (await insertExercise({ name: trimmed, muscleGroup }));
      setLibrary((prev) =>
        prev.some((e) => e.id === row.id)
          ? prev
          : [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
      );
      saveLibraryCache(userId, [...library.filter((e) => e.id !== row.id), row]);
      addExercise(row);
      return row;
    },
    [library, userId, addExercise],
  );

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
    online,
    pendingSync,
    type,
    setType,
    finished,
    setFinished,
    addExercise,
    createExercise,
    updateExercise,
    removeExercise,
    toggle,
  };
}
