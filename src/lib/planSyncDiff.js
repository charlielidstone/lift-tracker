// planSyncDiff — pure diff logic for the PLANS offline outbox (mirrors syncDiff.js
// for workouts). Given the DESIRED plans (on screen) and the SYNCED baseline (what
// the server last confirmed), compute the ops to reconcile them. No I/O → testable.
//
// A plan snapshot has TWO maps: plans (parent rows) and exercises (plan_exercises
// children), because inserts must create the parent plan before its exercises.

// Flatten UI plans → { plans: Map<planId,row>, exercises: Map<peId,row> }.
export function snapshotPlans(plans) {
  const planMap = new Map();
  const exMap = new Map();
  for (const p of plans) {
    planMap.set(p.id, { id: p.id, type: p.type, name: p.name });
    p.exercises.forEach((ex, i) => {
      exMap.set(ex.id, {
        id: ex.id,
        planId: p.id,
        exerciseId: ex.exerciseId,
        targetSets: ex.targetSets,
        repMin: ex.repMin,
        repMax: ex.repMax,
        rpe: ex.rpe ?? null,
        position: ex.position ?? i,
      });
    });
  }
  return { plans: planMap, exercises: exMap };
}

export function planExerciseChanged(a, b) {
  return (
    a.targetSets !== b.targetSets ||
    a.repMin !== b.repMin ||
    a.repMax !== b.repMax ||
    a.rpe !== b.rpe ||
    a.position !== b.position ||
    a.exerciseId !== b.exerciseId ||
    a.planId !== b.planId
  );
}

// Serialize a snapshot (Maps) → plain arrays for localStorage, and back.
export function snapshotToRows(snap) {
  return {
    plans: [...snap.plans.values()],
    exercises: [...snap.exercises.values()],
  };
}

export function rowsToSnapshot(rows) {
  return {
    plans: new Map((rows?.plans ?? []).map((r) => [r.id, r])),
    exercises: new Map((rows?.exercises ?? []).map((r) => [r.id, r])),
  };
}

// Compute reconciliation ops between a desired snapshot and the synced baseline.
// Returns descriptors (no side effects). The hook applies them in a FK-safe order:
//   planInserts → exInserts → exUpdates → exDeletes → planDeletes.
export function diffPlanOps(desired, synced) {
  const planInserts = [];
  const planDeletes = [];
  const exInserts = [];
  const exUpdates = [];
  const exDeletes = [];

  for (const [id, p] of desired.plans) {
    if (!synced.plans.has(id)) planInserts.push(p);
  }
  for (const [id] of synced.plans) {
    if (!desired.plans.has(id)) planDeletes.push(id);
  }
  for (const [id, row] of desired.exercises) {
    const prev = synced.exercises.get(id);
    if (!prev) exInserts.push(row);
    else if (planExerciseChanged(prev, row)) exUpdates.push(row);
  }
  for (const [id, row] of synced.exercises) {
    if (!desired.exercises.has(id)) exDeletes.push(row.id);
  }

  return { planInserts, planDeletes, exInserts, exUpdates, exDeletes };
}

// True when the outbox is non-empty (there are un-synced local edits).
export function hasPendingPlanOps(desired, synced) {
  const d = diffPlanOps(desired, synced);
  return (
    d.planInserts.length > 0 ||
    d.planDeletes.length > 0 ||
    d.exInserts.length > 0 ||
    d.exUpdates.length > 0 ||
    d.exDeletes.length > 0
  );
}
