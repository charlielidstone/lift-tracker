// progress.js — build a per-exercise progress series from workout history.
//
// For one exercise, reduce each session that included it to a single data point:
//   { date, e1rm, topWeight, volume, sets }
// so the UI can plot strength (estimated 1RM), top set, or work (volume) over time.
// Weight is canonical lb throughout; the UI converts for display.
//
// Pure + no React. History is the app shape returned by fetchWorkoutHistory:
//   [{ date, exercises: [{ exerciseId, name, sets: [{ weight, reps }] }] }, ...]

import { estimateOneRepMax } from '@/lib/oneRepMax';

// Metric keys the UI can plot. Kept here so the chart + toggles stay in sync.
export const METRICS = [
  { id: 'e1rm', label: 'Est. 1RM' },
  { id: 'topWeight', label: 'Top set' },
  { id: 'volume', label: 'Volume' },
];

// Reduce one exercise's sets (within a single session) to its summary stats.
// Ignores sets with non-positive weight or reps (incomplete/placeholder rows).
function summarizeSets(sets) {
  let topWeight = 0;
  let volume = 0;
  let e1rm = 0;
  let counted = 0;
  for (const s of sets ?? []) {
    const w = Number(s.weight);
    const r = Number(s.reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r < 1) continue;
    counted += 1;
    volume += w * r;
    if (w > topWeight) topWeight = w;
    const est = estimateOneRepMax(w, r);
    if (est > e1rm) e1rm = est;
  }
  return counted ? { e1rm, topWeight, volume, sets: counted } : null;
}

// Build the time-ordered (OLDEST first, for left-to-right charting) progress series
// for one exercise. One point per session that included it and had valid sets.
export function exerciseProgress(history, exerciseId) {
  if (!exerciseId) return [];
  const points = [];
  for (const w of history ?? []) {
    if (!w?.date) continue;
    const ex = (w.exercises ?? []).find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const stats = summarizeSets(ex.sets);
    if (!stats) continue;
    points.push({ date: w.date, ...stats });
  }
  // history arrives newest-first; charts read left→right oldest→newest.
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

// Every exercise that appears anywhere in history, with how many sessions logged
// it and its most recent date — for a "pick an exercise" list. Sorted by most
// recently trained. Each: { exerciseId, name, sessions, lastDate }.
export function trackedExercises(history) {
  const byId = new Map();
  for (const w of history ?? []) {
    for (const ex of w.exercises ?? []) {
      if (!ex.exerciseId || !(ex.sets ?? []).some((s) => Number(s.weight) > 0)) continue;
      const cur = byId.get(ex.exerciseId) ?? {
        exerciseId: ex.exerciseId,
        name: ex.name,
        sessions: 0,
        lastDate: '',
      };
      cur.sessions += 1;
      if (w.date && w.date > cur.lastDate) cur.lastDate = w.date;
      if (ex.name) cur.name = ex.name; // prefer a present name
      byId.set(ex.exerciseId, cur);
    }
  }
  return [...byId.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

// Convenience for a headline delta: first vs latest value of a metric, with the
// percent change. Returns null when there's fewer than 2 points.
export function metricTrend(series, metric) {
  if (!series || series.length < 2) return null;
  const first = series[0][metric];
  const last = series[series.length - 1][metric];
  const pct = first === 0 ? null : ((last - first) / first) * 100;
  return { first, last, delta: last - first, pct };
}
