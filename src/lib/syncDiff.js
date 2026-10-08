// syncDiff — pure diff logic for the offline outbox.
//
// Given the DESIRED set-rows (what's on screen) and the SYNCED baseline (what the
// server last confirmed), compute the operations needed to reconcile them. No I/O
// here — the hook maps these descriptors to Supabase calls. Pure = unit-testable.

// Flatten UI exercises → Map<setId, row> where row is the persistable shape.
export function snapshotSets(exercises) {
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

export function rowChanged(a, b) {
  return (
    a.weight !== b.weight ||
    a.reps !== b.reps ||
    a.rpe !== b.rpe ||
    a.setOrder !== b.setOrder ||
    a.exerciseId !== b.exerciseId
  );
}

// Rehydrate a saved snapshot (array of rows, from localStorage) into a Map.
export function rowsToMap(rows) {
  return new Map((rows ?? []).map((r) => [r.id, r]));
}

export function mapToRows(map) {
  return [...map.values()];
}

// Compute the reconciliation ops between a desired Map and a saved Map.
// Returns descriptors (no side effects):
//   { inserts:[row], updates:[row], setDeletes:[id], exerciseDeletes:[exerciseId] }
// A whole-exercise removal collapses its set deletions into one exerciseDelete.
export function diffOps(desired, saved) {
  const inserts = [];
  const updates = [];
  const setDeletes = [];
  const exerciseDeletes = [];

  for (const [id, row] of desired) {
    const prev = saved.get(id);
    if (!prev) inserts.push(row);
    else if (rowChanged(prev, row)) updates.push(row);
  }

  const survivingExercises = new Set([...desired.values()].map((r) => r.exerciseId));
  const handledExercises = new Set();
  for (const [id, row] of saved) {
    if (desired.has(id)) continue;
    if (!survivingExercises.has(row.exerciseId)) {
      if (!handledExercises.has(row.exerciseId)) {
        handledExercises.add(row.exerciseId);
        exerciseDeletes.push(row.exerciseId);
      }
    } else {
      setDeletes.push(id);
    }
  }

  return { inserts, updates, setDeletes, exerciseDeletes };
}

// True when there are any pending ops (the outbox is non-empty).
export function hasPendingOps(desired, saved) {
  const { inserts, updates, setDeletes, exerciseDeletes } = diffOps(desired, saved);
  return (
    inserts.length > 0 ||
    updates.length > 0 ||
    setDeletes.length > 0 ||
    exerciseDeletes.length > 0
  );
}

// Data-loss guard (third-incident fix). A FINISHED workout should never be emptied
// by a background sync. This detects the destructive pattern: the desired state has
// NO sets while the reference (server copy / synced baseline) still DOES — i.e. a
// poisoned cache would make diffOps delete every set of a locked workout.
//
// Used two ways in useWorkout:
//   • reconcile: if this holds for cached-desired vs the server, ADOPT the server
//     (self-heal) instead of treating the empty cache as a real local edit;
//   • flush: if this holds for desired vs the synced baseline, REFUSE the deletes.
export function isFinishedWorkoutWipe({ finished, desiredSetCount, referenceSetCount }) {
  return Boolean(finished) && desiredSetCount === 0 && referenceSetCount > 0;
}
