// WorkoutHistory — list of past workouts, newest first, grouped by day.
// Each day is collapsible (tap the date heading). Expanded, it shows the
// exercises and sets read-only, with an "Edit" button that opens an inline
// editor: change the type label, adjust set weight/reps/RPE, and delete sets.
// Saving diffs the edited copy against the original and applies the minimal
// DB writes (workoutEdit.diffWorkout + workoutRepo.applyWorkoutEdits).
//
// Data comes from workoutRepo.fetchWorkoutHistory; loading/error/empty states
// mirror the pattern in useWorkout.js. Caches for offline viewing.

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExerciseCard } from '@/components/ExerciseCard';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { loadHistoryCache, saveHistoryCache } from '@/lib/localCache';
import { fetchWorkoutHistory, applyWorkoutEdits } from '@/lib/workoutRepo';
import { diffWorkout, isEmptyDiff } from '@/lib/workoutEdit';
import { WORKOUT_TYPES } from '@/lib/defaults';

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

function WorkoutDay({ workout, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  // Editable working copy (deep clone so edits don't touch the cached list).
  const [draft, setDraft] = useState(null);
  const [expandedExId, setExpandedExId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(workout)));
    setError(null);
    setExpandedExId(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setError(null);
  };

  const setDraftType = (type) => setDraft((d) => ({ ...d, type }));

  const updateExercise = (exId, next) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex) => (ex.id === exId ? next : ex)),
    }));

  const removeExercise = (exId) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((ex) => ex.id !== exId) }));

  const save = async () => {
    const diff = diffWorkout(workout, draft);
    if (isEmptyDiff(diff)) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await applyWorkoutEdits(workout.id, diff);
      setEditing(false);
      setDraft(null);
      await onSaved(); // refetch history so the list reflects the saved state
    } catch (e) {
      console.error('[WorkoutHistory] save failed', e);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit mode ──
  if (editing && draft) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-accent/60 bg-accent/5 p-3">
        <span className="text-sm font-semibold text-foreground">
          Editing {formatDate(workout.date)}
        </span>

        {/* Type picker — tap to set/toggle off. */}
        <div className="flex flex-wrap gap-1.5">
          {WORKOUT_TYPES.map((t) => {
            const active = draft.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setDraftType(active ? null : t)}
                aria-pressed={active}
                className={
                  active
                    ? 'rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground'
                    : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground'
                }
              >
                {t}
              </button>
            );
          })}
        </div>

        {draft.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            expanded={expandedExId === exercise.id}
            onToggle={() => setExpandedExId((cur) => (cur === exercise.id ? null : exercise.id))}
            onChange={(next) => updateExercise(exercise.id, next)}
            onRemove={() => removeExercise(exercise.id)}
            readOnly={false}
          />
        ))}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="mt-1 flex gap-2">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Read-only view ──
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

      {expanded && (
        <>
          {workout.exercises.map((exercise) => (
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEdit}
            className="self-start"
          >
            <Pencil className="size-4" /> Edit
          </Button>
        </>
      )}
    </div>
  );
}

export function WorkoutHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false); // showing cached data (offline)

  // Fetch (or refetch) history and update the cache. Shared by the initial load
  // and the post-save refresh so the edited workout shows its new state.
  async function refresh() {
    const data = await fetchWorkoutHistory();
    setWorkouts(data);
    saveHistoryCache(userId, data);
    setStale(false);
    setError(null);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    // Hydrate from cache first so history is viewable instantly + offline.
    // (setState-in-effect is intentional: syncing from an external store.)
    /* eslint-disable react/set-state-in-effect */
    const cached = loadHistoryCache(userId);
    if (cached) {
      setWorkouts(cached);
      setLoading(false);
    }
    /* eslint-enable react/set-state-in-effect */

    (async () => {
      try {
        const data = await fetchWorkoutHistory();
        if (cancelled) return;
        setWorkouts(data);
        saveHistoryCache(userId, data);
        setStale(false);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        // Offline / server error: keep cached history if we have it, just flag it.
        if (cached) setStale(true);
        else setError(e);
        console.error('[WorkoutHistory] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      {stale && (
        <p className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          📴 Offline — showing your last saved history. Editing needs a connection.
        </p>
      )}
      {workouts
        .filter((w) => w.exercises.length > 0)
        .map((workout) => (
          <WorkoutDay key={workout.id} workout={workout} onSaved={refresh} />
        ))}
    </div>
  );
}
