// weeklyStats.js — bucket training history into Monday-based weeks for the
// Progress tab's weekly bar chart (Strava-style). Pure, no React.
//
// History is the app shape from fetchWorkoutHistory:
//   [{ date: 'YYYY-MM-DD', exercises: [{ sets: [{ weight, reps }] }] }]
// Weight is canonical lb; volume is lb·reps. A workout counts only if it has
// at least one real logged set (weight > 0, reps >= 1).

// Parse 'YYYY-MM-DD' to a local Date at noon (avoids tz day-drift).
function parseDay(iso) {
  return new Date(`${iso}T12:00:00`);
}

// The Monday on or before `date`, as 'YYYY-MM-DD'. Weeks start Monday.
export function mondayOf(date) {
  const d = parseDay(typeof date === 'string' ? date : date.toISOString().slice(0, 10));
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function hasRealSets(workout) {
  return (workout.exercises ?? []).some((e) =>
    (e.sets ?? []).some((s) => Number(s.weight) > 0 && Number(s.reps) >= 1),
  );
}

// Workouts + volume for a single session (one gym day).
function sessionTotals(workout) {
  let volume = 0;
  for (const ex of workout.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      const wt = Number(s.weight);
      const r = Number(s.reps);
      if (wt > 0 && r >= 1) volume += wt * r;
    }
  }
  return volume;
}

// Build the last `weeks` Monday-based weeks ending with the week containing
// `todayIso`, oldest-first. Empty weeks are included (workouts: 0, volume: 0)
// so the chart shows honest gaps. Each bucket:
//   { weekStart: 'YYYY-MM-DD', workouts: number, volume: number, label: 'Sep 29' }
export function weeklyStats(history, weeks = 12, todayIso = new Date().toISOString().slice(0, 10)) {
  const thisMonday = mondayOf(todayIso);

  // Pre-seed the window with empty buckets, oldest-first.
  const buckets = new Map();
  const order = [];
  const cursor = parseDay(thisMonday);
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { weekStart: key, workouts: 0, volume: 0 });
    order.push(key);
  }

  for (const w of history ?? []) {
    if (!w.date || !hasRealSets(w)) continue;
    const key = mondayOf(w.date);
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the window
    bucket.workouts += 1;
    bucket.volume += sessionTotals(w);
  }

  return order.map((key) => {
    const b = buckets.get(key);
    return {
      ...b,
      label: parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
}
