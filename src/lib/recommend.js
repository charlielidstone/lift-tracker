// recommendExercises — pick the exercises to surface as one-tap chips on Today.
//
// Pure + testable. Given the workout history and the currently-selected type,
// rank exercises by how often they appear in past workouts of that TYPE; fall
// back to overall frequency when no type is set (or that type has no history).
// Exercises already in today's workout are excluded (no point re-recommending).
//
// Split integration (optional): when the selected type maps to a split day with
// muscle groups, exercises whose muscle group is in that day's groups are boosted
// to the top (still history-ranked within the boosted/un-boosted tiers). This is
// how a planned split drives the chips without changing manual adding.

// history: [{ type, exercises: [{ exerciseId, name }, ...] }, ...]
// opts.boostGroups: string[] of muscle groups to prioritize (lowercased)
// opts.muscleById: Map/obj exerciseId → muscle_group (to know each exercise's group)
// Returns up to `limit` { exerciseId, name } objects, most-relevant first.
export function recommendExercises(
  history,
  { type, excludeIds = [], limit = 6, boostGroups = [], muscleById = null } = {},
) {
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

  // Look up an exercise's muscle group from the provided map (Map or plain obj).
  const groupOf = (id) => {
    if (!muscleById) return null;
    const g = muscleById instanceof Map ? muscleById.get(id) : muscleById[id];
    return g ? String(g).toLowerCase() : null;
  };
  const boost = new Set((boostGroups ?? []).map((g) => String(g).toLowerCase()));

  ranked.sort((a, b) => {
    // Split-day muscle groups first, then history frequency, then name.
    if (boost.size) {
      const ab = boost.has(groupOf(a.exerciseId)) ? 1 : 0;
      const bb = boost.has(groupOf(b.exerciseId)) ? 1 : 0;
      if (ab !== bb) return bb - ab;
    }
    return b.count - a.count || a.name.localeCompare(b.name);
  });
  return ranked.slice(0, limit).map(({ exerciseId, name }) => ({ exerciseId, name }));
}
