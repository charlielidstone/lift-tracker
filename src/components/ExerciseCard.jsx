// ExerciseCard — one exercise in the workout. Collapsible.
// Header shows the exercise name + a summary (e.g. set count) and toggles expand/collapse.
// Expanded: a SetRow per set, plus "add set". Collapsed: just the header (keeps list short).
//
// An "exercise entry" shape (a workout has many of these):
//   { id, exerciseId, name, sets: [ { id, weight, reps, rpe }, ... ] }
//
// Props:
//   exercise      object   — { id, exerciseId, name, sets }
//   expanded      boolean  — is this card open? (parent owns which one is open)
//   onToggle      () => void
//   onChange      (nextExercise:object) => void  — updated exercise (e.g. after a set edit)
//   onRemove      () => void  — remove this exercise from the workout
//
// TODO (Charlie):
//   - header: name + set count + chevron (lucide ChevronDown/ChevronRight), tap → onToggle
//   - when expanded: map exercise.sets → <SetRow>, wiring each set's onChange/onDelete back
//     into onChange with the updated sets array
//   - "add set" button: append a new set built from DEFAULT_SET (import from '@/lib/defaults'),
//     give it a fresh id (crypto.randomUUID()), call onChange
//   - wrap it in the shadcn Card (npx shadcn@latest add card) for consistent styling
//
// NOTE: adding an exercise (in WorkoutView) should pre-seed it with ONE set = DEFAULT_SET,
//       so a logged-as-planned set is zero taps (design philosophy: sensible pre-fill).

import { SetRow } from '@/components/SetRow';
import { DEFAULT_SET } from '@/lib/defaults';

export function ExerciseCard({ exercise, expanded, onToggle, onChange, onRemove }) {
  // TODO: collapsible header + SetRow list + add set
  return null;
}
