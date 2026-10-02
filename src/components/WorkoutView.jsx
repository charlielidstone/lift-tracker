// WorkoutView — today's workout: type picker, recommended one-tap chips, the
// exercise cards, and a searchable picker as the full-list backup.
// State + persistence come from the shared WorkoutProvider (so the Library screen
// adds to the same workout). A finished workout renders read-only (locked).

import { ExerciseCard } from '@/components/ExerciseCard';
import { ExercisePicker } from '@/components/ExercisePicker';
import { RecommendedExercises } from '@/components/RecommendedExercises';
import { Button } from '@/components/ui/button';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';
import { WORKOUT_TYPES } from '@/lib/defaults';

export function WorkoutView() {
  const {
    exercises,
    expandedId,
    library,
    loading,
    error,
    online,
    pendingSync,
    type,
    setType,
    finished,
    setFinished,
    addExercise,
    updateExercise,
    removeExercise,
    toggle,
  } = useWorkoutContext();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading today's workout…</p>;
  }

  const hasExercises = exercises.length > 0;
  const inWorkoutIds = exercises.map((e) => e.exerciseId);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-destructive">
          Couldn't sync with the server — changes may not be saved.
        </p>
      )}

      {/* Sync status — offline edits are cached and pushed on reconnect. */}
      {!online && (
        <p className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          Offline — changes are saved on this device and will sync when you're back online.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{online && pendingSync && "Syncing…"}</p>

      {/* Locked banner + unlock. */}
      {finished && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <span className="text-sm font-medium text-foreground">Workout finished — locked</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setFinished(false)}>
            Edit workout
          </Button>
        </div>
      )}

      {/* Workout type picker — tap to set/toggle off. Disabled when finished. */}
      <div className="flex flex-wrap gap-1.5">
        {WORKOUT_TYPES.map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              disabled={finished}
              onClick={() => setType(active ? null : t)}
              aria-pressed={active}
              className={
                (active
                  ? 'rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground') +
                (finished ? ' opacity-50' : '')
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          expanded={expandedId === exercise.id}
          onToggle={() => toggle(exercise.id)}
          onChange={(next) => updateExercise(exercise.id, next)}
          onRemove={() => removeExercise(exercise.id)}
          readOnly={finished}
        />
      ))}

      {/* Add exercises — recommended chips + searchable picker. Hidden when locked. */}
      {!finished && (
        <div className="flex flex-col gap-3">
          <RecommendedExercises type={type} inWorkoutIds={inWorkoutIds} onPick={addExercise} />
          <ExercisePicker library={library} inWorkoutIds={inWorkoutIds} onPick={addExercise} />
          {!hasExercises && (
            <p className="text-sm text-muted-foreground">
              No exercises yet — tap a suggestion or search to add one.
            </p>
          )}
        </div>
      )}

      {/* Finish button — only when there's something to lock and not already finished. */}
      {!finished && hasExercises && (
        <Button type="button" className="mt-2" onClick={() => setFinished(true)}>
          Finish workout
        </Button>
      )}
    </div>
  );
}
