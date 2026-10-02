// ProgressView — the Progress tab. Pick an exercise, see its stats over time
// (estimated 1RM / top set / volume) as a hand-rolled SVG line chart.
//
// Reads from the history cache (same source as the History tab + smart defaults),
// so it works offline. Falls back to a fresh fetch when online.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/SettingsProvider';
import { loadHistoryCache, saveHistoryCache } from '@/lib/localCache';
import { fetchWorkoutHistory } from '@/lib/workoutRepo';
import { exerciseProgress, metricTrend, trackedExercises, METRICS } from '@/lib/progress';
import { toDisplayWeight, unitLabel } from '@/lib/units';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/LineChart';

// 'YYYY-MM-DD' → 'Sep 24' (local noon so the label doesn't drift across tz).
function shortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ProgressView() {
  const { user } = useAuth();
  const { unit } = useSettings();
  const userId = user?.id ?? null;

  const [history, setHistory] = useState(() => loadHistoryCache(userId) ?? []);
  const [loading, setLoading] = useState(isSupabaseConfigured && !loadHistoryCache(userId));
  const [selected, setSelected] = useState(null); // exerciseId
  const [metric, setMetric] = useState('e1rm');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchWorkoutHistory(1000);
        if (cancelled) return;
        setHistory(data);
        saveHistoryCache(userId, data);
      } catch (e) {
        console.error('[ProgressView] history load failed (using cache)', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const exercises = useMemo(() => trackedExercises(history), [history]);
  const series = useMemo(
    () => (selected ? exerciseProgress(history, selected) : []),
    [history, selected],
  );
  const selectedName = exercises.find((e) => e.exerciseId === selected)?.name ?? '';

  // Chart points in DISPLAY units; weight-based metrics convert lb→unit.
  const isWeightMetric = metric !== 'volume'; // volume shown as-is (lb·reps scale)
  const points = series.map((p, i) => ({
    x: i, // evenly spaced by session (dates can cluster); labels show real dates
    y: isWeightMetric ? toDisplayWeight(p[metric], unit) : p[metric],
    label: shortDate(p.date),
  }));
  const trend = metricTrend(series, metric);
  // Delta in DISPLAY units (points are already converted); avoids re-converting lb.
  const displayDelta = points.length >= 2 ? points[points.length - 1].y - points[0].y : 0;
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? '';
  const yUnit = metric === 'volume' ? `${unitLabel(unit)}·reps` : unitLabel(unit);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your history…</p>;
  }

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted-foreground">Sign in to see your progress.</p>;
  }

  // ── Exercise list ──
  if (!selected) {
    if (exercises.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No logged exercises yet. Finish a workout and your progress will show here.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Pick an exercise to see it over time.</p>
        {exercises.map((e) => (
          <button
            key={e.exerciseId}
            type="button"
            onClick={() => setSelected(e.exerciseId)}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted"
          >
            <span className="text-sm text-foreground">{e.name}</span>
            <span className="text-xs text-muted-foreground">
              {e.sessions} session{e.sessions === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // ── Detail: chart for the selected exercise ──
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All exercises
      </button>

      <h2 className="text-lg font-semibold">{selectedName}</h2>

      {/* metric toggle */}
      <div className="flex gap-2">
        {METRICS.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="sm"
            variant={metric === m.id ? 'default' : 'outline'}
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {series.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          {series.length === 0
            ? 'No data for this metric yet.'
            : 'Just one session so far — log it again to see a trend.'}
        </p>
      ) : (
        <>
          {trend && (
            <p className="text-sm">
              <span className="font-medium">{metricLabel}:</span>{' '}
              {Math.round(points[0].y)} → {Math.round(points[points.length - 1].y)} {yUnit}{' '}
              <span className={displayDelta >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                ({displayDelta >= 0 ? '+' : ''}
                {Math.round(displayDelta)}
                {trend.pct != null ? `, ${trend.pct >= 0 ? '+' : ''}${trend.pct.toFixed(0)}%` : ''})
              </span>
            </p>
          )}
          <LineChart points={points} formatY={(v) => String(Math.round(v))} />
        </>
      )}
    </div>
  );
}
