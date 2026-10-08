// PlansProvider — owns the user's session plans (per-type exercise templates) and
// shares them with both the Plan tab (editor) and Today (checklist). Local-first:
// hydrate from cache instantly, reconcile with the server, write through to cache.
//
// Plans are low-stakes templates, so persistence is simpler than the workout outbox:
// mutations update local state + cache optimistically and fire-and-forget to the
// server (logged on failure). Reads always work offline from cache.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SET } from '@/lib/defaults';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { loadPlansCache, savePlansCache } from '@/lib/localCache';
import {
  createPlan,
  deletePlanExercise,
  fetchPlans,
  insertPlanExercise,
  updatePlanExercise as persistPlanExercise,
} from '@/lib/planRepo';

const PlansContext = createContext(null);

// Defaults for a freshly-added plan exercise: 3 sets, a 8–12 range, RPE from the
// shared set default. Charlie edits from here.
const NEW_PLAN_EXERCISE = { targetSets: 3, repMin: 8, repMax: 12, rpe: DEFAULT_SET.rpe };

export function PlansProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const hydratedRef = useRef(false);

  // Hydrate from cache, then reconcile with the server.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    /* eslint-disable react/set-state-in-effect */
    const cached = loadPlansCache(userId);
    if (cached) setPlans(cached);
    /* eslint-enable react/set-state-in-effect */
    (async () => {
      try {
        const data = await fetchPlans();
        if (cancelled) return;
        setPlans(data);
        savePlansCache(userId, data);
      } catch (e) {
        // Offline / error: keep the cached copy (plans are read-only-safe to stale).
        console.error('[PlansProvider] load failed (using cache)', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hydratedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Write-through cache on every change (after hydration).
  useEffect(() => {
    if (!isSupabaseConfigured || !hydratedRef.current) return;
    savePlansCache(userId, plans);
  }, [plans, userId]);

  const getPlan = useCallback((type) => plans.find((p) => p.type === type) ?? null, [plans]);

  // Add a library exercise to a type's plan, creating the plan row if this is the
  // first exercise for that type. Optimistic; persists in the background.
  const addExerciseToPlan = useCallback(
    async (type, libraryExercise) => {
      const exId = libraryExercise.id ?? libraryExercise.exerciseId;
      const existing = plans.find((p) => p.type === type);
      // Don't add a duplicate exercise to the same plan.
      if (existing?.exercises.some((e) => e.exerciseId === exId)) return;

      const planId = existing?.id ?? crypto.randomUUID();
      const position = existing ? existing.exercises.length : 0;
      const newEx = {
        id: crypto.randomUUID(),
        exerciseId: exId,
        name: libraryExercise.name,
        muscleGroup: libraryExercise.muscle_group ?? libraryExercise.muscleGroup ?? null,
        ...NEW_PLAN_EXERCISE,
        position,
      };

      setPlans((prev) => {
        const idx = prev.findIndex((p) => p.type === type);
        if (idx === -1) {
          return [...prev, { id: planId, type, name: 'Default', exercises: [newEx] }];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], exercises: [...next[idx].exercises, newEx] };
        return next;
      });

      try {
        if (!existing) await createPlan({ id: planId, type });
        await insertPlanExercise({
          id: newEx.id,
          planId,
          exerciseId: exId,
          targetSets: newEx.targetSets,
          repMin: newEx.repMin,
          repMax: newEx.repMax,
          rpe: newEx.rpe,
          position,
        });
      } catch (e) {
        console.error('[PlansProvider] addExerciseToPlan failed', e);
      }
    },
    [plans],
  );

  // Patch a plan exercise's targets (UI keys: targetSets/repMin/repMax/rpe).
  const updatePlanExercise = useCallback((planId, peId, patch) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              exercises: p.exercises.map((e) => (e.id === peId ? { ...e, ...patch } : e)),
            }
          : p,
      ),
    );
    // Translate UI keys → DB column names for persistence.
    const dbPatch = {};
    if ('targetSets' in patch) dbPatch.target_sets = patch.targetSets;
    if ('repMin' in patch) dbPatch.rep_min = patch.repMin;
    if ('repMax' in patch) dbPatch.rep_max = patch.repMax;
    if ('rpe' in patch) dbPatch.target_rpe = patch.rpe;
    persistPlanExercise(peId, dbPatch).catch((e) =>
      console.error('[PlansProvider] updatePlanExercise failed', e),
    );
  }, []);

  const removePlanExercise = useCallback((planId, peId) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, exercises: p.exercises.filter((e) => e.id !== peId) }
          : p,
      ),
    );
    deletePlanExercise(peId).catch((e) =>
      console.error('[PlansProvider] removePlanExercise failed', e),
    );
  }, []);

  return (
    <PlansContext.Provider
      value={{ plans, loading, getPlan, addExerciseToPlan, updatePlanExercise, removePlanExercise }}
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
