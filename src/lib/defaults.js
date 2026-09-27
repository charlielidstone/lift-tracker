// Shared defaults & increments for set logging.
// Single source of truth — see docs/DECISIONS.md #6, #7.
// v1 values are fixed; later these may derive from the last workout per exercise.

export const DEFAULT_SET = {
  weight: 100, // lb (canonical unit — see STANDARDS.md)
  reps: 12,
  rpe: 8,
};

export const STEP = {
  weight: 5, // lb per tap
  reps: 1,
  rpe: 1,
};

// Guard rails so steppers can't go nonsensical.
export const BOUNDS = {
  weight: { min: 0, max: 2000 },
  reps: { min: 1, max: 100 },
  rpe: { min: 1, max: 10 },
};

// Fixed set of workout types (labels). Stored in workouts.type; the app
// constrains input to this list. null/unset = unlabeled.
export const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Arms'];
