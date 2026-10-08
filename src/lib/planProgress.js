// planProgress — pure logic mapping a session PLAN against what's been LOGGED today.
// No React, no I/O → unit-tested in planProgress.test.js.
//
// Feeds the Today checklist: for each planned exercise, how many of its target
// sets are done, whether the target is met, and whether you BEAT the plan (hit the
// top of the rep-range at an RPE easy enough to add weight next time).

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

// Progress for one planned exercise given the sets logged for it today.
// Returns { exerciseId, name, targetSets, repMin, repMax, rpe, doneSets,
//           remaining, met, addWeight }.
//   met       — logged at least targetSets sets
//   addWeight — met AND every logged set beat the plan (ready to go heavier)
export function exerciseProgress(planExercise, loggedSets = []) {
  const doneSets = loggedSets.length;
  const met = doneSets >= planExercise.targetSets;
  const addWeight =
    doneSets >= planExercise.targetSets &&
    loggedSets.every((s) => setBeatsPlan(s, planExercise));
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
  };
}

// The full checklist for a plan given today's logged exercises (UI workout shape:
// [{ exerciseId, sets: [{ reps, rpe, weight }] }]). Order follows the plan's
// editor order; unplanned logged exercises are ignored here (shown separately).
export function planChecklist(plan, loggedExercises = []) {
  if (!plan) return [];
  const byId = new Map(loggedExercises.map((e) => [e.exerciseId, e.sets ?? []]));
  return plan.exercises.map((pe) => exerciseProgress(pe, byId.get(pe.exerciseId) ?? []));
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
