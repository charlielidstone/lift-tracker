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
import { defaultWeightFor } from '@/lib/lastWeight';
import { isRest, resolveToday } from '@/lib/schedule';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  loadHistoryCache,
  loadLibraryCache,
  loadScheduleCache,
  loadSyncedSnapshot,
  loadWorkoutCache,
  saveLibraryCache,
  saveSyncedSnapshot,
  saveWorkoutCache,
} from '@/lib/localCache';
import { diffOps, hasPendingOps, isFinishedWorkoutWipe, mapToRows, rowsToMap, snapshotSets } from '@/lib/syncDiff';
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
  const autoTypeRef = useRef(false); // schedule auto-set attempted once
  const exercisesRef = useRef(exercises); // latest exercises for reconnect flush
  const historyRef = useRef(null); // cached workout history → smart default weights
  const finishedRef = useRef(finished); // latest finished flag for the flush guard
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);
  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

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
    historyRef.current = loadHistoryCache(userId); // for smart default weights
    if (cachedLib) setLibrary(cachedLib);

    // Is the cached (or absent) workout untouched? → eligible for schedule auto-set.
    const cachedUntouched =
      !cachedWorkout ||
      (!cachedWorkout.type &&
        (cachedWorkout.exercises?.length ?? 0) === 0 &&
        !cachedWorkout.finished);
    // Resolve the type to show: the cached type if present, else today's scheduled
    // type (with catch-up). Computed unconditionally so every render pass applies
    // the same value (no StrictMode double-invoke flicker back to null).
    let hydrateType = cachedWorkout?.type ?? null;
    if (cachedUntouched) {
      const { type: suggested } = resolveToday(
        loadScheduleCache(userId),
        historyRef.current ?? [],
        today,
      );
      if (!isRest(suggested)) hydrateType = suggested;
    }

    if (cachedWorkout) {
      workoutIdRef.current = cachedWorkout.workoutId ?? null;
      setWorkoutTypeState(hydrateType);
      setFinishedState(Boolean(cachedWorkout.finished));
      setExercises(cachedWorkout.exercises ?? []);
      // Baseline = last server-confirmed snapshot (NOT the desired state), so any
      // edits made offline are still detected as pending after this reload.
      savedRef.current = cachedSynced
        ? rowsToMap(cachedSynced)
        : snapshotSets(cachedWorkout.exercises ?? []);
      setLoading(false); // we have something to show; server will reconcile
    } else if (hydrateType) {
      // No cached workout yet, but the schedule has a type for today — show it.
      setWorkoutTypeState(hydrateType);
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
        setFinishedState(Boolean(workout.finished_at));
        // Resolve the effective type:
        //   1. Server type wins when it has one (it's authoritative once synced).
        //   2. Else if the LOCAL cache was touched (user set a type offline), keep
        //      that — don't let the server's null clobber an un-synced choice.
        //   3. Else (both untouched) pre-set today's scheduled type (with catch-up)
        //      and persist it. Rest days leave it unset.
        const untouchedServer =
          !workout.type && (workout.exercises?.length ?? 0) === 0 && !workout.finished_at;
        let effectiveType = workout.type ?? null;
        if (!workout.type && !cachedUntouched) {
          effectiveType = cachedWorkout.type ?? null; // keep un-synced local choice
        } else if (untouchedServer && cachedUntouched) {
          const { type: suggested } = resolveToday(
            loadScheduleCache(userId),
            loadHistoryCache(userId) ?? [],
            today,
          );
          if (!isRest(suggested)) {
            effectiveType = suggested;
            if (!autoTypeRef.current) {
              autoTypeRef.current = true;
              persistWorkoutType(workout.id, suggested).catch((e) =>
                console.error('[useWorkout] auto-set type failed', e),
              );
            }
          }
        }
        setWorkoutTypeState(effectiveType);
        // Adopt the server copy UNLESS there are genuine un-synced LOCAL edits.
        // "Local edits" = cached desired state differs from the last-synced
        // baseline (savedRef) — NOT from the server. Comparing against the server
        // would wrongly treat an out-of-band server change (e.g. a CLI/admin edit)
        // as a local edit and freeze the stale cache. When there are no pending
        // local edits, the server always wins.
        const serverSnap = snapshotSets(workout.exercises);
        const cachedDesired = snapshotSets(cachedWorkout?.exercises ?? []);
        const localEdits = cachedWorkout
          ? hasPendingOps(cachedDesired, savedRef.current)
          : false;
        // Data-loss self-heal: if the cached desired is an EMPTY wipe of a FINISHED
        // workout the server still has sets for, that "local edit" is the destructive
        // delete bug (poisoned cache), NOT a real edit — adopt the server instead of
        // keeping the empty cache (which would otherwise flush deletes). See the
        // third data-loss incident + isFinishedWorkoutWipe.
        const finishedWipe = isFinishedWorkoutWipe({
          finished: Boolean(workout.finished_at),
          desiredSetCount: cachedDesired.size,
          referenceSetCount: serverSnap.size,
        });
        if (finishedWipe) {
          console.error(
            '[useWorkout] recovered a finished-workout wipe from cache — adopting server copy',
          );
        }
        if (!localEdits || finishedWipe) {
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

    // Data-loss guard: refuse to delete the sets of a FINISHED workout when the
    // desired state is empty but the baseline still has sets (poisoned cache). This
    // is the destructive pattern behind the third data-loss incident — never run it.
    if (
      isFinishedWorkoutWipe({
        finished: finishedRef.current,
        desiredSetCount: desired.size,
        referenceSetCount: saved.size,
      }) &&
      (setDeletes.length > 0 || exerciseDeletes.length > 0)
    ) {
      console.error(
        '[useWorkout] BLOCKED a destructive flush: refusing to empty a finished workout ' +
          `(${setDeletes.length} set + ${exerciseDeletes.length} exercise deletes). ` +
          'Reload to re-adopt the server copy.',
      );
      setPendingSync(false);
      return { ok: false, pending: false, reason: 'blocked-wipe' };
    }

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
      return { ok: true, pending: false };
    }
    try {
      await Promise.all(ops);
      commitSynced(desired); // baseline advances only after writes succeed
      setPendingSync(false);
      setError(null);
      return { ok: true, pending: false };
    } catch (e) {
      // Offline / server error: keep the pending flag so the reconnect listener
      // (and next edit) retries. Edits are safe in the write-through cache.
      setPendingSync(true);
      console.error('[useWorkout] save failed (will retry)', e);
      return { ok: false, pending: true };
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
      // Smart default: open with the weight from the most recent session that
      // included this exercise; fall back to DEFAULT_SET.weight if never logged.
      const weight = defaultWeightFor(historyRef.current, exId, DEFAULT_SET.weight);
      const entry = {
        id: crypto.randomUUID(),
        exerciseId: exId,
        name: libraryExercise.name,
        sets: [{ ...newSet(), weight }], // zero-tap logged set (design philosophy)
      };
      targetId = entry.id;
      return [...prev, entry];
    });
    if (targetId) setExpandedId(targetId);
  }, []);

  // Create a brand-new library exercise (library only — NOT added to today).
  // Case-insensitive dedupe against the existing library (reuses the match
  // instead of duplicating). Returns the library row used. Online-only (DB mints id).
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
      return row;
    },
    [library, userId],
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

  // Finish (lock) or unlock the workout.
  // Unlock is immediate. FINISH first flushes pending sets to the server and only
  // locks if that succeeds — otherwise you can end up with a finished-but-empty
  // workout server-side while the real sets sit unsynced in the outbox (and get
  // lost if the cache is cleared). Returns { ok, reason } so the UI can warn.
  const setFinished = useCallback(
    async (next) => {
      if (!next) {
        // Unlocking — always safe.
        setFinishedState(false);
        if (workoutIdRef.current) {
          persistWorkoutFinished(workoutIdRef.current, false).catch((e) => {
            setError(e);
            console.error('[useWorkout] unlock failed', e);
          });
        }
        return { ok: true };
      }

      // Finishing: make sure every set is actually on the server first.
      if (isSupabaseConfigured) {
        const result = await flush();
        if (!result.ok) {
          // Still pending (offline / server error) — do NOT lock. Sets would be
          // stranded in the outbox behind a locked, read-only workout.
          return { ok: false, reason: 'pending' };
        }
      }
      setFinishedState(true);
      if (workoutIdRef.current) {
        persistWorkoutFinished(workoutIdRef.current, true).catch((e) => {
          setError(e);
          console.error('[useWorkout] setFinished failed', e);
        });
      }
      return { ok: true };
    },
    [flush],
  );

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
