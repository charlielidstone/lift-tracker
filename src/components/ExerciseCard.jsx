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

import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { SetRow } from '@/components/SetRow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_SET } from '@/lib/defaults';

export function ExerciseCard({ exercise, expanded, onToggle, onChange, onRemove }) {
  const { name, sets } = exercise;

  // Patch one set (by index) with a partial update, e.g. { weight: 105 }.
  const patchSet = (index, patch) => {
    const nextSets = sets.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...exercise, sets: nextSets });
  };

  const deleteSet = (index) => {
    onChange({ ...exercise, sets: sets.filter((_, i) => i !== index) });
  };

  const addSet = () => {
    // Copy the previous set's values (weight/reps/rpe) so consecutive sets match;
    // fall back to DEFAULT_SET for the very first set.
    const prev = sets[sets.length - 1];
    const base = prev ? { weight: prev.weight, reps: prev.reps, rpe: prev.rpe } : DEFAULT_SET;
    const newSet = { id: crypto.randomUUID(), ...base };
    onChange({ ...exercise, sets: [...sets, newSet] });
  };

  return (
    <Card className="w-full">
      <CardHeader
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={expanded}
        className="flex flex-row items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <CardTitle>{name}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {sets.length} {sets.length === 1 ? 'set' : 'sets'}
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Remove ${name}`}
            >
              <X />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the exercise and all {sets.length} of its{' '}
                {sets.length === 1 ? 'set' : 'sets'}. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onRemove}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-2">
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              index={index + 1}
              set={set}
              onChange={(patch) => patchSet(index, patch)}
              onDelete={() => deleteSet(index)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addSet}
            aria-label="Add set"
            className="self-start"
          >
            <Plus /> Add set
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
