// RecommendedExercises — one-tap chips of likely-next exercises, ranked from
// history by the selected workout type (falls back to overall). Tapping a chip
// adds it to today. Hidden when there's nothing to recommend.

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { loadHistoryCache, saveHistoryCache } from '@/lib/localCache';
import { fetchWorkoutHistory } from '@/lib/workoutRepo';
import { recommendExercises } from '@/lib/recommend';
import { groupsForType } from '@/lib/split';
import { useSplit } from '@/hooks/SplitProvider';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';

export function RecommendedExercises({ type, inWorkoutIds, onPick }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { split } = useSplit();
  const { library } = useWorkoutContext();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    /* eslint-disable react/set-state-in-effect */
    const cached = loadHistoryCache(userId);
    if (cached) setHistory(cached);
    /* eslint-enable react/set-state-in-effect */
    (async () => {
      try {
        const data = await fetchWorkoutHistory();
        if (cancelled) return;
        setHistory(data);
        saveHistoryCache(userId, data);
      } catch (e) {
        console.error('[RecommendedExercises] history load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Map exerciseId → muscle_group so the split day's groups can boost chips.
  const muscleById = useMemo(() => {
    const m = {};
    for (const e of library ?? []) m[e.id] = e.muscle_group ?? null;
    return m;
  }, [library]);
  const boostGroups = useMemo(() => groupsForType(split, type), [split, type]);

  const recs = recommendExercises(history, {
    type,
    excludeIds: inWorkoutIds,
    limit: 6,
    boostGroups,
    muscleById,
  });
  if (recs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {type ? `Suggested for ${type}` : 'Suggested'}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {recs.map((r) => (
          <button
            key={r.exerciseId}
            type="button"
            onClick={() => onPick({ id: r.exerciseId, name: r.name })}
            className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Plus className="size-3.5" /> {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
