// overview.js — headline training stats across ALL history, for the Progress
// tab's overview. Pure, no React. History is the app shape from
// fetchWorkoutHistory: [{ date, exercises: [{ exerciseId, name, sets:[{weight,reps}] }] }].
// Weight is canonical lb; volume is lb·reps. Dates are 'YYYY-MM-DD' local.

// A workout "counts" as a gym day if it has at least one real logged set.
function hasRealSets(workout) {
  return (workout.exercises ?? []).some((e) =>
    (e.sets ?? []).some((s) => Number(s.weight) > 0 && Number(s.reps) >= 1),
  );
}

// Parse 'YYYY-MM-DD' to a local Date at noon (avoids tz day-drift).
function parseDay(iso) {
  return new Date(`${iso}T12:00:00`);
}

// Whole days between two 'YYYY-MM-DD' dates (b - a).
function daysBetween(aIso, bIso) {
  const ms = parseDay(bIso) - parseDay(aIso);
  return Math.round(ms / 86400000);
}

// Count sessions whose date is within the last `days` days of `todayIso`.
function countWithinDays(days, todayIso, dayList) {
  return dayList.filter((d) => {
    const diff = daysBetween(d, todayIso);
    return diff >= 0 && diff < days;
  }).length;
}

// Longest run of consecutive ISO-WEEKS that had at least one gym day, ending at
// the most recent trained week. "Weeks in a row" is a friendlier streak for
// lifters than consecutive days. Uses Monday-based week keys.
function weekKey(iso) {
  const d = parseDay(iso);
  // ISO week: shift to Thursday of the same week, then year + week number.
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week =
    1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentWeekStreak(dayList, todayIso) {
  if (!dayList.length) return 0;
  const weeks = new Set(dayList.map(weekKey));
  // Walk back week-by-week from this week while each has a session.
  let streak = 0;
  const cursor = parseDay(todayIso);
  // Only start counting once we hit a trained week (so a rest "this week" doesn't zero it).
  let started = false;
  for (let i = 0; i < 520; i++) {
    const key = weekKey(cursor.toISOString().slice(0, 10));
    if (weeks.has(key)) {
      streak += 1;
      started = true;
    } else if (started) {
      break;
    } else if (i > 1) {
      // allow the current (possibly untrained) week + one grace week, then stop
      break;
    }
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

// Build the overview. `todayIso` defaults to the real local today.
export function overviewStats(history, todayIso = new Date().toISOString().slice(0, 10)) {
  const sessions = (history ?? []).filter(hasRealSets);
  if (!sessions.length) {
    return {
      gymDays: 0,
      totalSets: 0,
      totalVolume: 0,
      thisWeek: 0,
      thisMonth: 0,
      weekStreak: 0,
      firstDate: null,
      lastDate: null,
      avgPerWeek: 0,
      topExercise: null,
    };
  }

  const dayList = sessions.map((w) => w.date).filter(Boolean);
  let totalSets = 0;
  let totalVolume = 0;
  const byExercise = new Map();

  for (const w of sessions) {
    for (const ex of w.exercises ?? []) {
      for (const s of ex.sets ?? []) {
        const wt = Number(s.weight);
        const r = Number(s.reps);
        if (!(wt > 0) || !(r >= 1)) continue;
        totalSets += 1;
        totalVolume += wt * r;
        const cur = byExercise.get(ex.exerciseId) ?? { name: ex.name, sessions: 0 };
        byExercise.set(ex.exerciseId, cur);
      }
    }
    // count a session once per exercise present (for "most trained")
    for (const ex of w.exercises ?? []) {
      if (!byExercise.has(ex.exerciseId)) continue;
      if ((ex.sets ?? []).some((s) => Number(s.weight) > 0)) {
        byExercise.get(ex.exerciseId).sessions += 1;
      }
    }
  }

  const sortedDays = [...dayList].sort();
  const firstDate = sortedDays[0];
  const lastDate = sortedDays[sortedDays.length - 1];
  const spanDays = Math.max(1, daysBetween(firstDate, lastDate) + 1);
  const avgPerWeek = (sessions.length / spanDays) * 7;

  let topExercise = null;
  for (const v of byExercise.values()) {
    if (!topExercise || v.sessions > topExercise.sessions) topExercise = v;
  }

  return {
    gymDays: sessions.length,
    totalSets,
    totalVolume,
    thisWeek: countWithinDays(7, todayIso, dayList),
    thisMonth: countWithinDays(30, todayIso, dayList),
    weekStreak: currentWeekStreak(dayList, todayIso),
    firstDate,
    lastDate,
    avgPerWeek: Math.round(avgPerWeek * 10) / 10,
    topExercise: topExercise ? { name: topExercise.name, sessions: topExercise.sessions } : null,
  };
}
