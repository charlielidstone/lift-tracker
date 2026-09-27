// WorkoutHistory — read-only list of past workouts, newest first, grouped by day.
// Each day shows its date heading, then its exercises and their sets
// (weight lb × reps, RPE if present). No inline editing in v1 — just a compact log.
// Data comes from workoutRepo.fetchWorkoutHistory; loading/error/empty states mirror
// the pattern in useWorkout.js.

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { fetchWorkoutHistory } from '@/lib/workoutRepo';

// Format an ISO date (YYYY-MM-DD) as e.g. 'Sat, Sep 26'. Parse as local noon so
// the day label doesn't drift across timezones.
function formatDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function WorkoutHistory() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchWorkoutHistory();
        if (!cancelled) setWorkouts(data);
      } catch (e) {
        if (!cancelled) setError(e);
        console.error('[WorkoutHistory] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading workout history…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Couldn't load workout history.</p>;
  }

  if (workouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No past workouts yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {workouts.map((workout) => (
        <div key={workout.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {formatDate(workout.date)}
            {workout.name ? ` · ${workout.name}` : ''}
          </h2>

          {workout.exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sets logged.</p>
          ) : (
            workout.exercises.map((exercise) => (
              <Card key={exercise.id} className="w-full">
                <CardHeader>
                  <CardTitle>{exercise.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {exercise.sets.map((set, index) => (
                    <div
                      key={set.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="w-5 shrink-0">{index + 1}.</span>
                      <span className="text-foreground">
                        {set.weight} lb × {set.reps}
                      </span>
                      {set.rpe != null && <span>RPE {set.rpe}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
