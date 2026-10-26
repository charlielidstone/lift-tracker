// planProgress — pure logic mapping a session PLAN against what's been LOGGED today.
// No React, no I/O → unit-tested in planProgress.test.js.
//
// Feeds the Today checklist: for each planned exercise, how many of its target
// sets are done, whether the target is met, and whether you BEAT the plan (hit the
// top of the rep-range at an RPE easy enough to add weight next time).

import { substitutesFor, normalizeExerciseName } from '@/lib/substitutions';

// Default RPE ceiling used when a plan exercise has no explicit target RPE: a set
// at/above the top rep count feeling this easy or easier means "add weight".
const DEFAULT_RPE_CEILING = 8;

// Did a single set beat the plan? Top-of-range reps AND RPE at/under the ceiling.
// A missing RPE is inconclusive → not a beat (we don't nudge without evidence).
export function setBeatsPlan(set, planExercise) {
  if (!set || !planExercise) return false;
  const ceiling = planExercise.rpe ?? DEFAULT_RPE_CEILING;
  const hitTopReps = Number(set.reps) >= planExercise.repMax;
  const easyEnough = set.rpe != null && Number(set.rpe) <= ceiling;
  return hitTopReps && easyEnough;
}

// Did a whole session (list of sets) beat the plan for this exercise?
// True when it logged at least targetSets sets AND every one beat the plan.
// Shared by the live (today) flag and the carried-forward hint.
function sessionBeatsPlan(sets, planExercise) {
  return (
    sets.length >= planExercise.targetSets &&
    sets.every((s) => setBeatsPlan(s, planExercise))
  );
}

// Most recent PRIOR session (newest-first history) of `type` that logged this
// exercise with sets — its set list, or [] if none. Feeds the carried nudge.
// History shape: [{ type, exercises: [{ exerciseId, sets }] }, ...].
export function lastSessionSetsFor(history, exerciseId, type) {
  if (!exerciseId) return [];
  for (const w of history ?? []) {
    if (type && w.type !== type) continue;
    const ex = (w.exercises ?? []).find((e) => e.exerciseId === exerciseId);
    if (ex && (ex.sets ?? []).length) return ex.sets;
  }
  return [];
}

// Progress for one planned exercise given the sets logged for it today and the
// sets from the most recent prior session of this type (priorSets).
// Returns { exerciseId, name, targetSets, repMin, repMax, rpe, doneSets,
//           remaining, met, addWeight, carryAddWeight }.
//   met            — logged at least targetSets sets today
//   addWeight      — met AND every logged set beat the plan TODAY (just earned it)
//   carryAddWeight — nothing logged today yet AND last session of this type beat
//                    the plan (a reminder to go heavier). Clears the moment you
//                    log any set for this exercise today.
export function exerciseProgress(planExercise, loggedSets = [], priorSets = []) {
  const doneSets = loggedSets.length;
  const met = doneSets >= planExercise.targetSets;
  const addWeight = sessionBeatsPlan(loggedSets, planExercise);
  const carryAddWeight = doneSets === 0 && sessionBeatsPlan(priorSets, planExercise);
  return {
    exerciseId: planExercise.exerciseId,
    name: planExercise.name,
    targetSets: planExercise.targetSets,
    repMin: planExercise.repMin,
    repMax: planExercise.repMax,
    rpe: planExercise.rpe,
    doneSets,
    remaining: Math.max(0, planExercise.targetSets - doneSets),
    met,
    addWeight,
    carryAddWeight,
  };
}

// Sets that count toward one plan slot: the sets logged under the slot's exact
// exercise id, PLUS (when a name lookup is available) sets logged under any
// EQUIVALENT exercise (substitutions.js groups) — e.g. a barbell bench counts
// toward a "Flat dumbbell press" slot. Own-id sets are always counted even if
// the name can't be resolved; substitute sets are added by normalized name, and
// the slot's own name bucket is skipped so its sets are never double-counted.
function setsForPlanExercise(planExercise, byId, byName) {
  const own = byId.get(planExercise.exerciseId) ?? [];
  if (!byName) return own;
  const group = substitutesFor(planExercise.name);
  const ownKey = normalizeExerciseName(planExercise.name);
  const extra = [];
  for (const [key, sets] of byName) {
    if (key === ownKey) continue; // the slot's own sets are already in `own`
    if (group.has(key)) extra.push(...sets);
  }
  return [...own, ...extra];
}

// The full checklist for a plan given today's logged exercises (UI workout shape:
// [{ exerciseId, sets: [{ reps, rpe, weight }] }]) and newest-first workout
// history (for the carried-forward "add weight" hint). Order follows the plan's
// editor order; unplanned logged exercises are ignored here (shown separately).
//
// `nameById` (exerciseId → exercise name, from the library) is OPTIONAL: pass it
// to let equivalent movements satisfy a plan slot (option A). Omit it and
// matching is exact-id only, exactly as before.
export function planChecklist(plan, loggedExercises = [], history = [], nameById = null) {
  if (!plan) return [];
  const byId = new Map(loggedExercises.map((e) => [e.exerciseId, e.sets ?? []]));
  // Group logged sets by normalized exercise name so substitutes can be matched.
  const byName = nameById
    ? loggedExercises.reduce((m, e) => {
        const name = nameById.get(e.exerciseId);
        if (!name) return m;
        const key = normalizeExerciseName(name);
        m.set(key, [...(m.get(key) ?? []), ...(e.sets ?? [])]);
        return m;
      }, new Map())
    : null;
  return plan.exercises.map((pe) =>
    exerciseProgress(
      pe,
      setsForPlanExercise(pe, byId, byName),
      lastSessionSetsFor(history, pe.exerciseId, plan.type),
    ),
  );
}

// A compact "n/total done" summary for a whole plan — for a header badge.
export function planSummary(checklist) {
  const total = checklist.length;
  const complete = checklist.filter((c) => c.met).length;
  return { complete, total, allDone: total > 0 && complete === total };
}

// Format a rep-range for display: "6–8" or just "8" when min === max.
export function formatRepRange(repMin, repMax) {
  return repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`;
}
