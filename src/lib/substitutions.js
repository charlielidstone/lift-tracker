// substitutions.js — exercise EQUIVALENCE groups (MVP "option A").
//
// A plan slot is tied to one library exercise (e.g. "Flat dumbbell press"), but
// in the gym you often do an equivalent movement instead (a barbell bench, a
// machine press). Without this, the equivalent doesn't count toward the plan and
// the checklist item never ticks off. These curated groups let planChecklist
// treat any member of a group as satisfying a plan slot for any other member.
//
// SCOPE RULE (decided with Charlie): a group is only TRUE movement equivalents —
// the barbell / dumbbell / machine / smith versions of the SAME press or raise.
// Different patterns do NOT belong together: a pec deck (fly) must NOT satisfy a
// flat-press slot, a row must NOT satisfy a rear-delt-fly slot, etc.
//
// Names here are matched case/spacing-insensitively (see normalizeExerciseName)
// and MUST match real library exercise names (see the exercises table). Editing
// groups is a one-file change — add a name to a group, or add a new group array.
//
// ─────────────────────────────────────────────────────────────────────────────
// FUTURE UPGRADE — "option B" (DB-backed, user-editable per plan slot)
// ─────────────────────────────────────────────────────────────────────────────
// When Charlie wants to manage substitutes in-app instead of editing this file:
//   1. SCHEMA: add substitutes to the plan slot, NOT the exercise. A new join
//      table `plan_exercise_substitutes` (plan_exercise_id FK, exercise_id FK,
//      owner-only RLS like 005/006/007) is cleaner than an array column — it
//      keeps substitutes per-slot and FK-safe. Ships as a new migration
//      (NNN_plan_exercise_substitutes.sql) that Charlie runs in the SQL editor.
//   2. REPO/SYNC: extend planRepo.js to read substitutes with the plan, and
//      planSyncDiff.js (snapshotPlans / diffPlanOps) to diff substitute
//      inserts/deletes alongside exInserts/exUpdates/exDeletes, applied FK-safe
//      (plan → exercise → substitute). PlansProvider carries them in the same
//      durable outbox + synced baseline it already uses.
//   3. EDITOR UI: in PlanEditor.jsx, each exercise row gets an "also counts: …"
//      affordance — a small ExercisePicker to attach alternates to that slot
//      (reuse ExercisePicker + MuscleTag; same view/edit-mode convention).
//   4. MATCHING: planChecklist swaps the static substitutesFor() below for a
//      lookup into each plan exercise's own `substitutes` list. Keep this file's
//      curated groups as the DEFAULT/seed so existing plans keep working and a
//      slot with no explicit substitutes falls back to its movement group.
//   The MVP→B change is isolated to how substitutesFor() resolves — the
//   planChecklist wiring (below) does not change shape, so A→B throws nothing away.
// ─────────────────────────────────────────────────────────────────────────────

// Curated equivalence groups. Each inner array is one group of interchangeable
// movements. A name may only sensibly live in ONE group.
export const SUBSTITUTION_GROUPS = [
  // Flat horizontal chest press — barbell / dumbbell / machine / smith.
  [
    'Bench Press',
    'Flat dumbbell press',
    'Dumbbell Bench Press',
    'Machine chest press',
    'Smith Machine Bench Press',
  ],
  // Incline chest press — barbell / dumbbell.
  ['Incline Bench Press', 'Incline dumbbell press'],
  // Overhead / shoulder press — machine / dumbbell (seated or standing).
  [
    'Machine shoulder press',
    'Dumbbell shoulder press',
    'Dumbbell Seated Shoulder Press',
    'Seated Dumbbell Press',
    'Standing Dumbbell Press',
    'Overhead Press',
  ],
  // Side-delt lateral raise — dumbbell / cable / machine.
  [
    'Lateral Raise',
    'Dumbbell lateral raise',
    'Cable Lateral Raise',
    'Cable Lat Raises',
    'Machine Lateral Raise',
    'Single arm cable lat raise',
  ],
  // Tricep pushdown — bar / rope / straight-bar cable.
  ['Tricep Pushdown', 'Rope Tricep Pushdown', 'Straight bar cable tricep pushdown'],
  // Overhead tricep extension — cable / dumbbell.
  ['Overhead tricep extension', 'Dumbbell Overhead Tricep Extension'],
];

// Lowercase, trim, collapse internal whitespace. Keeps matching robust to casing
// and stray spaces between near-identical names (e.g. "Flat dumbbell press" vs
// "Flat  Dumbbell  Press"). Pure.
export function normalizeExerciseName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Build normalized-name → group (Set of normalized names) once at module load.
const GROUP_BY_NAME = (() => {
  const map = new Map();
  for (const group of SUBSTITUTION_GROUPS) {
    const normalized = new Set(group.map(normalizeExerciseName));
    for (const key of normalized) map.set(key, normalized);
  }
  return map;
})();

// The set of normalized names that count as the SAME movement as `name` —
// always includes `name` itself. For an exercise in no group, that's just itself
// (so a plan slot with no equivalents behaves exactly as before). Pure.
export function substitutesFor(name) {
  const key = normalizeExerciseName(name);
  return GROUP_BY_NAME.get(key) ?? new Set([key]);
}
