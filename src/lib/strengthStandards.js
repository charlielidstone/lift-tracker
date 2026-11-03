// strengthStandards.js — rate a lift against population strength standards.
//
// Answers "where should I be?" for the big four barbell lifts by comparing your
// best estimated 1RM (from history) to bodyweight-multiple benchmarks, adjusted
// for sex and age. Pure, no React — the UI just renders the numbers.
//
// SOURCES / CAVEAT: the bodyweight multiples below are the widely-published
// Beginner→Elite bands (corroborated across StrengthLevel-derived tables, FitHQ,
// denstarfitness — they agree to ~0.05x). Faithful standards vary NONLINEARLY by
// bodyweight class (lighter lifters hit higher ratios); this flat-multiple model
// is a documented APPROXIMATION, good to roughly ±5-10% vs a full per-class table.
// Age scaling uses the McCulloch masters coefficients (the powerlifting standard).
// Weight is canonical lb throughout (matches the rest of the app).

import { estimateOneRepMax } from '@/lib/oneRepMax';

export const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

// The four lifts we rate, with the exercise names (normalized) that satisfy each.
// Order drives display order. `names` are matched case-insensitively against
// exercises.name rows — keep them equal to real library names.
export const STANDARD_LIFTS = [
  { id: 'squat', label: 'Squat', names: ['squat', 'back squat'] },
  { id: 'bench', label: 'Bench Press', names: ['bench press'] },
  { id: 'deadlift', label: 'Deadlift', names: ['deadlift'] },
  { id: 'ohp', label: 'Overhead Press', names: ['overhead press'] },
];

// Bodyweight multiples for a 1RM at each level [Beginner, Novice, Intermediate,
// Advanced, Elite], by sex. Multiply by bodyweight (and the age factor) for lb.
export const MULTIPLES = {
  male: {
    squat: [0.75, 1.25, 1.5, 2.0, 2.5],
    bench: [0.5, 0.75, 1.0, 1.5, 2.0],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    ohp: [0.35, 0.55, 0.8, 1.1, 1.4],
  },
  female: {
    squat: [0.5, 0.75, 1.25, 1.5, 2.0],
    bench: [0.25, 0.5, 0.75, 1.0, 1.5],
    deadlift: [0.5, 1.0, 1.5, 2.0, 2.5],
    ohp: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
};

// McCulloch masters age coefficients (powerlifting standard, APF/Glossbrenner).
// Strength peaks ~23-40; past 40 a given absolute lift is "worth more", so the
// bar to reach a level DROPS. We scale thresholds by 1/coefficient. Age ≤ 40 → 1.
const MCCULLOCH = {
  40: 1.0, 41: 1.01, 42: 1.02, 43: 1.031, 44: 1.043, 45: 1.055, 46: 1.068,
  47: 1.082, 48: 1.097, 49: 1.113, 50: 1.13, 51: 1.147, 52: 1.165, 53: 1.184,
  54: 1.204, 55: 1.225, 56: 1.246, 57: 1.268, 58: 1.291, 59: 1.315, 60: 1.34,
  61: 1.366, 62: 1.393, 63: 1.421, 64: 1.45, 65: 1.48, 66: 1.511, 67: 1.543,
  68: 1.576, 69: 1.61, 70: 1.645, 71: 1.681, 72: 1.718, 73: 1.756, 74: 1.795,
  75: 1.835, 76: 1.876, 77: 1.918, 78: 1.961, 79: 2.005, 80: 2.05,
};

/**
 * Age-scaling factor applied to every threshold. 1.0 in prime years (≤40), and
 * below 1.0 past 40 so standards ease with age (masters adjustment). Youth are
 * not adjusted (floored at 1.0). Non-finite/invalid age → 1.0 (no adjustment).
 * @param {number} age
 * @returns {number}
 */
export function ageFactor(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a <= 40) return 1;
  const key = Math.min(Math.round(a), 80);
  return 1 / MCCULLOCH[key];
}

export function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Which standard lift (id) an exercise name counts toward, or null if none.
 * @param {string} name
 */
export function liftIdForName(name) {
  const n = normalizeName(name);
  if (!n) return null;
  const hit = STANDARD_LIFTS.find((l) => l.names.includes(n));
  return hit ? hit.id : null;
}

/**
 * Level thresholds (lb) for one lift given the profile. Returns an object of
 * level → required 1RM in lb, or null if the profile/inputs are unusable.
 * @param {string} liftId
 * @param {{sex:string, bodyweightLb:number, age:number}} profile
 */
export function thresholdsFor(liftId, profile) {
  const sex = profile?.sex === 'female' ? 'female' : 'male';
  const bw = Number(profile?.bodyweightLb);
  const mult = MULTIPLES[sex]?.[liftId];
  if (!mult || !Number.isFinite(bw) || bw <= 0) return null;
  const f = ageFactor(profile?.age);
  const out = {};
  LEVELS.forEach((lvl, i) => {
    out[lvl] = mult[i] * bw * f;
  });
  return out;
}

/**
 * Rate a 1RM against a lift's thresholds.
 * Returns:
 *   level      — highest level reached, or null when below Beginner
 *   nextLevel  — the level above `level` (null at/above Elite)
 *   toNext     — lb still needed to reach nextLevel (0 at Elite)
 *   position   — 0..1 for a Beginner→Elite bar (levels at 0,.25,.5,.75,1)
 * @param {number} e1rm  best estimated 1RM, lb
 * @param {Object} thresholds  level→lb from thresholdsFor
 */
export function rateLift(e1rm, thresholds) {
  if (!thresholds) return null;
  const v = Number(e1rm);
  const vals = LEVELS.map((l) => thresholds[l]);

  // Highest level index whose threshold is met (−1 = below Beginner).
  let idx = -1;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (Number.isFinite(v) && v >= vals[i]) idx = i;
  }
  const level = idx >= 0 ? LEVELS[idx] : null;
  const nextLevel = idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;
  const toNext = nextLevel ? Math.max(0, vals[idx + 1] - v) : 0;

  // Marker position: levels are evenly spaced anchors at 0,.25,.5,.75,1; linear
  // within a segment. At/below Beginner → 0 (far left); above Elite → 1.
  const seg = 1 / (LEVELS.length - 1); // 0.25
  let position;
  if (!Number.isFinite(v) || v <= vals[0]) position = 0;
  else if (v >= vals[vals.length - 1]) position = 1;
  else {
    const lo = idx; // vals[lo] <= v < vals[lo+1]
    const frac = (v - vals[lo]) / (vals[lo + 1] - vals[lo]);
    position = (lo + frac) * seg;
  }
  return { level, nextLevel, toNext, position };
}

/**
 * Best estimated 1RM per standard lift from workout history. For each lift,
 * scans every session of every matching exercise and keeps the single best
 * est-1RM (your demonstrated capability = what standards compare against).
 * @param {Array} history  fetchWorkoutHistory shape
 * @returns {Object} liftId → { e1rm, name, date } (only lifts with data)
 */
export function bestE1rmByLift(history) {
  const best = {};
  for (const w of history ?? []) {
    for (const ex of w?.exercises ?? []) {
      const liftId = liftIdForName(ex?.name);
      if (!liftId) continue;
      for (const s of ex.sets ?? []) {
        const wt = Number(s.weight);
        const reps = Number(s.reps);
        if (!Number.isFinite(wt) || !Number.isFinite(reps) || wt <= 0 || reps < 1) continue;
        const est = estimateOneRepMax(wt, reps);
        if (!best[liftId] || est > best[liftId].e1rm) {
          best[liftId] = { e1rm: est, name: ex.name, date: w.date };
        }
      }
    }
  }
  return best;
}
