// exportWorkouts — pure formatters for the in-app data export.
//
// Input: workouts in the app shape
//   [{ date, type, exercises: [{ name, sets: [{ weight, reps, rpe }] }] }, ...]
// weight is canonical LB. Text output shows the user's chosen display unit; JSON
// keeps canonical lb (for exact restore) plus a meta block.

import { toDisplayWeight, unitLabel } from '@/lib/units';

// Keep only workouts whose date (YYYY-MM-DD) is within [from, to] inclusive.
// Either bound may be null/'' to leave that side open. String compare is valid
// for zero-padded ISO dates.
export function filterByRange(workouts, from, to) {
  return (workouts ?? []).filter((w) => {
    if (!w?.date) return false;
    if (from && w.date < from) return false;
    if (to && w.date > to) return false;
    return true;
  });
}

// Workouts that actually have logged sets (skip empty auto-created days).
function nonEmpty(workouts) {
  return (workouts ?? []).filter((w) => (w.exercises ?? []).some((e) => (e.sets ?? []).length));
}

export function workoutsToText(workouts, { unit = 'lb', from = null, to = null } = {}) {
  const list = [...nonEmpty(workouts)].sort((a, b) => a.date.localeCompare(b.date));
  const u = unitLabel(unit);
  const lines = [];
  lines.push('LIFT TRACKER — WORKOUT EXPORT');
  const range = from || to ? `${from || '…'} to ${to || '…'}` : 'all dates';
  lines.push(`range: ${range}   unit: ${u}`);
  let totalSets = 0;
  for (const w of list) for (const e of w.exercises ?? []) totalSets += (e.sets ?? []).length;
  lines.push(`workouts: ${list.length}   sets: ${totalSets}`);
  lines.push('='.repeat(44));
  for (const w of list) {
    lines.push('');
    lines.push(`${w.date}  (${w.type || '—'})`);
    for (const e of w.exercises ?? []) {
      if (!(e.sets ?? []).length) continue;
      lines.push(`  ${e.name}`);
      for (const s of e.sets) {
        const wt = toDisplayWeight(s.weight, unit);
        const rpe = s.rpe == null ? '' : ` @ RPE ${s.rpe}`;
        lines.push(`    - ${wt} ${u} × ${s.reps}${rpe}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

export function workoutsToJson(workouts, { from = null, to = null } = {}) {
  const list = [...nonEmpty(workouts)].sort((a, b) => a.date.localeCompare(b.date));
  const payload = {
    app: 'lift-tracker',
    exportedAt: new Date().toISOString(),
    range: { from: from || null, to: to || null },
    unit: 'lb', // canonical — weights below are lb
    workouts: list.map((w) => ({
      date: w.date,
      type: w.type ?? null,
      exercises: (w.exercises ?? [])
        .filter((e) => (e.sets ?? []).length)
        .map((e) => ({
          name: e.name,
          sets: e.sets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe ?? null })),
        })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// Suggested filename for a download, e.g. lift-tracker-2026-09-01_2026-10-02.txt
export function exportFilename(ext, from, to) {
  const span = from || to ? `${from || 'start'}_${to || 'end'}` : 'all';
  return `lift-tracker-${span}.${ext}`;
}
