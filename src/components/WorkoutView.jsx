// WorkoutView — today's workout: type picker, recommended one-tap chips, the
// exercise cards, and a searchable picker as the full-list backup.
// State + persistence come from the shared WorkoutProvider (so the Library screen
// adds to the same workout). A finished workout renders read-only (locked).

import { useState } from 'react';
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
  const [finishing, setFinishing] = useState(false);
  const [finishWarning, setFinishWarning] = useState(false);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading today's workout…</p>;
  }

  const handleFinish = async () => {
    setFinishWarning(false);
    setFinishing(true);
    try {
      const result = await setFinished(true);
      if (!result?.ok) setFinishWarning(true); // sets not synced — stayed unlocked
    } finally {
      setFinishing(false);
    }
  };

  const hasExercises = exercises.length > 0;
  const inWorkoutIds = exercises.map((e) => e.exerciseId);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-destructive">
          Couldn't sync with the server — changes may not be saved.
        </p>
      )}

      {/* Sync status — offline edits are cached and pushed on reconnect.
          Loud warning while anything is unsynced: do NOT clear app data now. */}
      {!online && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          📴 Offline — changes are saved on this device only and will sync when you're back
          online. Don't clear app data or reinstall until this clears.
        </p>
      )}
      {online && pendingSync && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
          Syncing unsaved changes… don't clear app data until this finishes.
        </p>
      )}

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

      {/* Finish button — only when there's something to lock and not already finished.
          Finishing flushes sets to the server first and refuses to lock if the sync
          fails, so you never get a locked-but-empty workout. */}
      {!finished && hasExercises && (
        <div className="mt-2 flex flex-col gap-1.5">
          {finishWarning && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Couldn't finish — your sets aren't synced yet (you may be offline). They're still
              saved on this device. Reconnect and try again; don't clear app data meanwhile.
            </p>
          )}
          <Button type="button" onClick={handleFinish} disabled={finishing}>
            {finishing ? 'Saving…' : 'Finish workout'}
          </Button>
        </div>
      )}
    </div>
  );
}
