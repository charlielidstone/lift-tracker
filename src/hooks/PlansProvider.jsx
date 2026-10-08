// PlansProvider — owns the user's session plans (per-type exercise templates) and
// shares them with the Plan tab (editor) and Today (checklist).
//
// DURABLE local-first, same outbox pattern as useWorkout (no data loss):
//   edit → React state → write-through localStorage cache → debounced flush to
//   Supabase; offline edits stay in the cache and flush on reconnect. A separate
//   SYNCED BASELINE (last server-confirmed snapshot, also persisted) is the outbox
//   baseline, so pending ops = diffPlanOps(desired, synced) survive a reload.
//
// Reconcile rule (mirrors useWorkout): on load, adopt the SERVER copy UNLESS the
// cached desired state differs from the synced baseline — i.e. there are genuine
// un-synced local edits. Comparing against the server instead would mistake an
// out-of-band DB edit for a local edit and freeze a stale cache.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SET } from '@/lib/defaults';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  loadPlansCache,
  loadPlansSynced,
  savePlansCache,
  savePlansSynced,
} from '@/lib/localCache';
import {
  diffPlanOps,
  hasPendingPlanOps,
  snapshotPlans,
  snapshotToRows,
  rowsToSnapshot,
} from '@/lib/planSyncDiff';
import {
  createPlan,
  deletePlan,
  deletePlanExercise,
  fetchPlans,
  insertPlanExercise,
  updatePlanExercise as persistPlanExercise,
} from '@/lib/planRepo';

const PlansContext = createContext(null);
const SAVE_DEBOUNCE_MS = 700;

// Defaults for a freshly-added plan exercise: 3 sets, 8–12 reps, RPE from the
// shared set default. Charlie edits from here.
const NEW_PLAN_EXERCISE = { targetSets: 3, repMin: 8, repMax: 12, rpe: DEFAULT_SET.rpe };

export function PlansProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingSync, setPendingSync] = useState(false);

  const savedRef = useRef({ plans: new Map(), exercises: new Map() }); // synced baseline
  const plansRef = useRef(plans); // latest desired state for reconnect flush
  const hydratedRef = useRef(false);
  const timerRef = useRef(null);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  // Persist the synced baseline in memory AND to localStorage so the outbox
  // baseline survives an offline reload (else local edits look already-saved).
  const commitSynced = useCallback(
    (snap) => {
      savedRef.current = snap;
      savePlansSynced(userId, snapshotToRows(snap));
    },
    [userId],
  );

  // ── Initial load: cache first (instant, offline-safe), then server ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    /* eslint-disable react/set-state-in-effect */
    const cached = loadPlansCache(userId);
    const cachedSynced = loadPlansSynced(userId);
    if (cached) setPlans(cached);
    // Baseline = last server-confirmed snapshot (NOT desired), so offline edits
    // are still detected as pending after this reload.
    savedRef.current = cachedSynced ? rowsToSnapshot(cachedSynced) : snapshotPlans(cached ?? []);
    if (cached) setLoading(false);
    /* eslint-enable react/set-state-in-effect */
    hydratedRef.current = true;

    (async () => {
      try {
        const data = await fetchPlans();
        if (cancelled) return;
        // Adopt the server copy UNLESS there are genuine un-synced LOCAL edits
        // (cached desired differs from the synced baseline).
        const localEdits = cached
          ? hasPendingPlanOps(snapshotPlans(cached), savedRef.current)
          : false;
        if (!localEdits) setPlans(data);
        commitSynced(snapshotPlans(data));
      } catch (e) {
        // Offline / error: keep the cached copy (never lose local edits).
        console.error('[PlansProvider] load failed (using cache)', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, commitSynced]);

  // ── Flush pending ops to the server (debounce + reconnect) ──
  const flush = useCallback(async () => {
    if (!isSupabaseConfigured) return { ok: true, pending: false };
    const desired = snapshotPlans(plansRef.current);
    const { planInserts, planDeletes, exInserts, exUpdates, exDeletes } = diffPlanOps(
      desired,
      savedRef.current,
    );
    if (
      !planInserts.length &&
      !planDeletes.length &&
      !exInserts.length &&
      !exUpdates.length &&
      !exDeletes.length
    ) {
      setPendingSync(false);
      return { ok: true, pending: false };
    }
    try {
      // FK-safe order: create plans → insert/update exercises → delete exercises
      // → delete plans. Ids are client-generated UUIDs, so retries are idempotent-ish.
      for (const p of planInserts) await createPlan({ id: p.id, type: p.type, name: p.name });
      for (const row of exInserts) await insertPlanExercise(row);
      for (const row of exUpdates) {
        await persistPlanExercise(row.id, {
          target_sets: row.targetSets,
          rep_min: row.repMin,
          rep_max: row.repMax,
          target_rpe: row.rpe,
          position: row.position,
        });
      }
      for (const id of exDeletes) await deletePlanExercise(id);
      for (const id of planDeletes) await deletePlan(id);
      commitSynced(desired); // baseline advances only after writes succeed
      setPendingSync(false);
      return { ok: true, pending: false };
    } catch (e) {
      setPendingSync(true); // keep pending; reconnect/next edit retries
      console.error('[PlansProvider] flush failed (will retry)', e);
      return { ok: false, pending: true };
    }
  }, [commitSynced]);

  // Debounced auto-save whenever plans change (after hydration).
  useEffect(() => {
    if (!isSupabaseConfigured || !hydratedRef.current) return;
    setPendingSync(hasPendingPlanOps(snapshotPlans(plans), savedRef.current));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [plans, flush]);

  // Write-through cache on every change (independent of the debounced flush).
  useEffect(() => {
    if (!isSupabaseConfigured || !hydratedRef.current) return;
    savePlansCache(userId, plans);
  }, [plans, userId]);

  // Online/offline: reflect status and drain the outbox on reconnect.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

  const getPlan = useCallback((type) => plans.find((p) => p.type === type) ?? null, [plans]);

  // ── Mutations: optimistic state only; persistence via the debounced flush ──
  const addExerciseToPlan = useCallback((type, libraryExercise) => {
    const exId = libraryExercise.id ?? libraryExercise.exerciseId;
    setPlans((prev) => {
      const existing = prev.find((p) => p.type === type);
      if (existing?.exercises.some((e) => e.exerciseId === exId)) return prev; // no dupe
      const newEx = {
        id: crypto.randomUUID(),
        exerciseId: exId,
        name: libraryExercise.name,
        muscleGroup: libraryExercise.muscle_group ?? libraryExercise.muscleGroup ?? null,
        ...NEW_PLAN_EXERCISE,
        position: existing ? existing.exercises.length : 0,
      };
      if (!existing) {
        return [...prev, { id: crypto.randomUUID(), type, name: 'Default', exercises: [newEx] }];
      }
      return prev.map((p) => (p.type === type ? { ...p, exercises: [...p.exercises, newEx] } : p));
    });
  }, []);

  const updatePlanExercise = useCallback((planId, peId, patch) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, exercises: p.exercises.map((e) => (e.id === peId ? { ...e, ...patch } : e)) }
          : p,
      ),
    );
  }, []);

  const removePlanExercise = useCallback((planId, peId) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, exercises: p.exercises.filter((e) => e.id !== peId) } : p,
      ),
    );
  }, []);

  return (
    <PlansContext.Provider
      value={{
        plans,
        loading,
        online,
        pendingSync,
        getPlan,
        addExerciseToPlan,
        updatePlanExercise,
        removePlanExercise,
      }}
    >
      {children}
    </PlansContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
