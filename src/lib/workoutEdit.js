// workoutEdit.js — compute the minimal set of DB writes to turn an ORIGINAL
// workout into an EDITED one, for the History edit screen. Pure, no React.
//
// Workout shape (UI model): { id, date, type, exercises: [
//   { id/exerciseId, name, sets: [{ id, weight, reps, rpe }] } ] }
//
// We diff at the SET level (plus the workout type), which covers every edit the
// History screen allows in one path:
//   - edit a set's weight/reps/rpe   → update
//   - delete a set                   → delete
//   - add a set                      → insert
//   - remove a whole exercise        → its sets all become deletes
// Weight is canonical lb; callers convert display→lb before building `edited`.

const SET_FIELDS = ['weight', 'reps', 'rpe'];

// Normalize a value for comparison (treat null/undefined alike; numbers as numbers).
function norm(v) {
  if (v == null) return null;
  return typeof v === 'number' ? v : Number(v);
}

// Flatten a workout's sets into a map id → { set, exerciseId, setOrder }.
function indexSets(workout) {
  const map = new Map();
  for (const ex of workout?.exercises ?? []) {
    const exerciseId = ex.exerciseId ?? ex.id;
    (ex.sets ?? []).forEach((set, i) => {
      map.set(set.id, { set, exerciseId, setOrder: i });
    });
  }
  return map;
}

// Returns { type: { changed, value }, updates: [{id, patch}], deletes: [id],
//           inserts: [{id, exerciseId, weight, reps, rpe, setOrder}] }.
export function diffWorkout(original, edited) {
  const before = indexSets(original);
  const after = indexSets(edited);

  const updates = [];
  const inserts = [];
  const deletes = [];

  // Inserts + updates: walk the edited sets.
  for (const [id, { set, exerciseId, setOrder }] of after) {
    const prev = before.get(id);
    if (!prev) {
      inserts.push({
        id,
        exerciseId,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe ?? null,
        setOrder,
      });
      continue;
    }
    const patch = {};
    for (const f of SET_FIELDS) {
      if (norm(set[f]) !== norm(prev.set[f])) patch[f] = set[f] ?? null;
    }
    if (Object.keys(patch).length > 0) updates.push({ id, patch });
  }

  // Deletes: sets present before but gone now.
  for (const id of before.keys()) {
    if (!after.has(id)) deletes.push(id);
  }

  const typeChanged = (original?.type ?? null) !== (edited?.type ?? null);

  return {
    type: { changed: typeChanged, value: edited?.type ?? null },
    updates,
    deletes,
    inserts,
  };
}

// True when a diff has no DB writes to make (used to skip a no-op save).
export function isEmptyDiff(diff) {
  return (
    !diff.type.changed &&
    diff.updates.length === 0 &&
    diff.deletes.length === 0 &&
    diff.inserts.length === 0
  );
}
