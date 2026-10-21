// muscleGroups.js — canonical muscle-group identity: a stable key, a display
// label, and a colour (for the badge + the weekly summary), plus the weekly
// sets-per-group roll-up. Pure, no React.
//
// PRIMARY-GROUP MODEL: each exercise has exactly ONE muscle_group, and a set
// counts fully toward that one group (decided with Charlie — no secondary-muscle
// split). Unknown/custom values collapse to an 'other' bucket so user-created
// exercises still get a stable tag and colour.

import { REST } from '@/lib/schedule';

// Each colour is a FULL, STATIC Tailwind class string — the JIT compiler only
// generates classes it finds as literals in source, so these must never be
// assembled dynamically. Tuned to read on the light theme, with a dark variant.
const GROUPS = {
  chest: {
    label: 'Chest',
    badge:
      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    bar: 'bg-rose-500',
  },
  back: {
    label: 'Back',
    badge:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    bar: 'bg-blue-500',
  },
  legs: {
    label: 'Legs',
    badge:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  shoulders: {
    label: 'Shoulders',
    badge:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    bar: 'bg-amber-500',
  },
  arms: {
    label: 'Arms',
    badge:
      'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
    bar: 'bg-violet-500',
  },
  core: {
    label: 'Core',
    badge:
      'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    bar: 'bg-cyan-500',
  },
};

const OTHER = {
  label: 'Other',
  badge:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
  bar: 'bg-slate-400',
};

// The canonical keys, in a stable display order (used by legends/menus).
export const MUSCLE_GROUP_KEYS = Object.keys(GROUPS);

function titleCase(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normalise a raw muscle_group value to a canonical key, or 'other' for any
// unknown/custom value, or null when there's no group at all.
export function muscleKey(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const k = String(raw).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(GROUPS, k) ? k : 'other';
}

// Canonical label for a key ('other' → 'Other'). Used by the summary rows.
export function groupLabel(key) {
  if (key === 'other') return OTHER.label;
  return GROUPS[key]?.label ?? OTHER.label;
}

// Solid bar colour class for a key (used by the weekly summary bars).
export function barColor(key) {
  if (key === 'other') return OTHER.bar;
  return GROUPS[key]?.bar ?? OTHER.bar;
}

// Display metadata for a raw muscle_group value: { key, label, badge, bar }, or
// null when there's no group. For a custom/unknown value the BADGE label shows
// the user's own wording title-cased (e.g. "forearms" → "Forearms") on the
// neutral 'other' colour, so it's still readable rather than a generic "Other".
export function muscleMeta(raw) {
  const key = muscleKey(raw);
  if (!key) return null;
  if (key === 'other') return { key, label: titleCase(raw), badge: OTHER.badge, bar: OTHER.bar };
  const g = GROUPS[key];
  return { key, label: g.label, badge: g.badge, bar: g.bar };
}

// weeklySetsByMuscle — roll the weekly schedule × session plans into total target
// working sets per muscle group for one week.
//   schedule: 7-slot array of type|REST (JS getDay indexed)
//   plans:    [{ type, exercises: [{ muscleGroup, targetSets }] }]
// A type scheduled N times in the week contributes its plan's sets N times.
// Only days whose type has a non-empty plan are counted. Primary group only.
// Returns { groups: [{ key, label, bar, sets } desc], total, daysPlanned }.
export function weeklySetsByMuscle(schedule, plans) {
  const planByType = new Map((plans ?? []).map((p) => [p.type, p]));
  const totals = new Map(); // key -> sets
  let daysPlanned = 0;

  for (const type of schedule ?? []) {
    if (!type || type === REST) continue;
    const plan = planByType.get(type);
    if (!plan || !(plan.exercises?.length > 0)) continue;
    daysPlanned += 1;
    for (const ex of plan.exercises) {
      const key = muscleKey(ex.muscleGroup) ?? 'other';
      const sets = Number(ex.targetSets) || 0;
      if (sets <= 0) continue;
      totals.set(key, (totals.get(key) ?? 0) + sets);
    }
  }

  const groups = [...totals.entries()]
    .map(([key, sets]) => ({ key, label: groupLabel(key), bar: barColor(key), sets }))
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label));
  const total = groups.reduce((n, g) => n + g.sets, 0);

  return { groups, total, daysPlanned };
}
