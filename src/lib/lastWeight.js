// lastWeight — smart default for a newly added exercise's first set.
//
// Looks back through workout history (newest first) for the most recent session
// that included this exercise, and reuses the weight you started that session
// with. Keeps you from re-dialing 100 lb every time. Weight is canonical lb.

// The first set of the most recent session containing `exerciseId`, or null.
// History is expected newest-first (as fetchWorkoutHistory returns it).
export function lastSetFor(history, exerciseId) {
  if (!exerciseId) return null;
  for (const w of history ?? []) {
    const ex = (w.exercises ?? []).find((e) => e.exerciseId === exerciseId);
    if (ex && (ex.sets ?? []).length) return ex.sets[0];
  }
  return null;
}

// Default weight (lb) for a new first set: the last session's opening weight,
// or `fallback` when this exercise has never been logged.
export function defaultWeightFor(history, exerciseId, fallback) {
  const s = lastSetFor(history, exerciseId);
  return s && Number.isFinite(s.weight) ? s.weight : fallback;
}
