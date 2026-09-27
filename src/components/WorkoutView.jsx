// WorkoutView — the top of the logging UI: today's workout as a list of exercises.
// State + persistence live in useWorkout (loads today's workout from Supabase and
// auto-saves changes). This component is presentational: render cards + add control.

import { ExerciseCard } from '@/components/ExerciseCard';
import { useWorkout } from '@/hooks/useWorkout';

export function WorkoutView() {
  const {
    exercises,
    expandedId,
    library,
    loading,
    error,
    addExercise,
    updateExercise,
    removeExercise,
    toggle,
  } = useWorkout();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading today's workout…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-destructive">
          Couldn't sync with the server — changes may not be saved.
        </p>
      )}

      {exercises.length === 0 && (
        <p className="text-sm text-muted-foreground">No exercises yet — add one to start.</p>
      )}

      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          expanded={expandedId === exercise.id}
          onToggle={() => toggle(exercise.id)}
          onChange={(next) => updateExercise(exercise.id, next)}
          onRemove={() => removeExercise(exercise.id)}
        />
      ))}

      {/* Add-exercise control — sourced from the seeded Supabase library. */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Add exercise"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value=""
          onChange={(e) => {
            const picked = library.find((x) => x.id === e.target.value);
            if (picked) addExercise(picked);
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Add exercise…
          </option>
          {library.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
