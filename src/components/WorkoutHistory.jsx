// WorkoutHistory — read-only list of past workouts, newest first, grouped by day.
// Each day is a collapsible section: tap the date heading to expand/collapse its
// exercises and sets (weight lb × reps, RPE if present). Collapsed by default with
// a compact summary. No inline editing in v1.
// Data comes from workoutRepo.fetchWorkoutHistory; loading/error/empty states mirror
// the pattern in useWorkout.js.

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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

// A short summary for the collapsed state, e.g. '5 exercises · 18 sets'.
function summarize(workout) {
  const exCount = workout.exercises.length;
  const setCount = workout.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const ex = `${exCount} exercise${exCount === 1 ? '' : 's'}`;
  const st = `${setCount} set${setCount === 1 ? '' : 's'}`;
  return `${ex} · ${st}`;
}

function WorkoutDay({ workout }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">
          {formatDate(workout.date)}
        </span>
        {workout.type && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {workout.type}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{summarize(workout)}</span>
      </button>

      {expanded &&
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
        ))}
    </div>
  );
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
      {workouts
        .filter((w) => w.exercises.length > 0)
        .map((workout) => (
          <WorkoutDay key={workout.id} workout={workout} />
        ))}
    </div>
  );
}
