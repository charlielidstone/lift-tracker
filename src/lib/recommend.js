// recommendExercises — pick the exercises to surface as one-tap chips on Today.
//
// Pure + testable. Given the workout history and the currently-selected type,
// rank exercises by how often they appear in past workouts of that TYPE; fall
// back to overall frequency when no type is set (or that type has no history).
// Exercises already in today's workout are excluded (no point re-recommending).

// history: [{ type, exercises: [{ exerciseId, name }, ...] }, ...]
// Returns up to `limit` { exerciseId, name } objects, most-frequent first.
export function recommendExercises(history, { type, excludeIds = [], limit = 6 } = {}) {
  const exclude = new Set(excludeIds);

  const tally = (workouts) => {
    const counts = new Map(); // exerciseId → { exerciseId, name, count }
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        if (!ex.exerciseId || exclude.has(ex.exerciseId)) continue;
        const prev = counts.get(ex.exerciseId);
        if (prev) prev.count += 1;
        else counts.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: ex.name, count: 1 });
      }
    }
    return [...counts.values()];
  };

  // Primary: same-type history. Fallback: all history.
  const typed = type ? (history ?? []).filter((w) => w.type === type) : [];
  let ranked = tally(typed);
  if (ranked.length === 0) ranked = tally(history ?? []);

  ranked.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return ranked.slice(0, limit).map(({ exerciseId, name }) => ({ exerciseId, name }));
}
