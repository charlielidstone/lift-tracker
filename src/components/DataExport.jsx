// DataExport — Settings section to export workouts over a chosen date range as a
// downloadable .txt (readable) or .json (exact restore). Fetches full history on
// demand, filters client-side, and triggers a browser download via a Blob URL.

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/SettingsProvider';
import { loadHistoryCache } from '@/lib/localCache';
import { fetchWorkoutHistory } from '@/lib/workoutRepo';
import {
  exportFilename,
  filterByRange,
  workoutsToJson,
  workoutsToText,
} from '@/lib/exportWorkouts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function triggerDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataExport() {
  const { user } = useAuth();
  const { unit } = useSettings();
  const userId = user?.id ?? null;

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Load the full history once (cache first, then server). A big limit so the
  // range filter has everything to work with.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    /* eslint-disable react/set-state-in-effect */
    const cached = loadHistoryCache(userId);
    if (cached) {
      setWorkouts(cached);
      setLoading(false);
    }
    /* eslint-enable react/set-state-in-effect */
    (async () => {
      try {
        const data = await fetchWorkoutHistory(1000);
        if (cancelled) return;
        setWorkouts(data);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e);
        setLoading(false);
        console.error('[DataExport] history load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const inRange = filterByRange(workouts, from || null, to || null).filter((w) =>
    (w.exercises ?? []).some((e) => (e.sets ?? []).length),
  );
  const count = inRange.length;

  const doExport = (fmt) => {
    const opts = { unit, from: from || null, to: to || null };
    if (fmt === 'json') {
      triggerDownload(
        exportFilename('json', from, to),
        workoutsToJson(workouts.length ? filterByRange(workouts, from || null, to || null) : [], opts),
        'application/json',
      );
    } else {
      triggerDownload(
        exportFilename('txt', from, to),
        workoutsToText(filterByRange(workouts, from || null, to || null), opts),
        'text/plain',
      );
    }
  };

  if (!isSupabaseConfigured) {
    return <p className="text-xs text-muted-foreground">Sign in to export your data.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Download your workouts as text (readable) or JSON (for backup/restore). Leave a date
        blank to leave that end open.
      </p>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading your history…</p>
      ) : error ? (
        <p className="text-xs text-destructive">Couldn't load history — try again when online.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {count} workout{count === 1 ? '' : 's'} in range.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={loading || count === 0} onClick={() => doExport('txt')}>
          <Download className="size-4" /> Text
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || count === 0}
          onClick={() => doExport('json')}
        >
          <Download className="size-4" /> JSON
        </Button>
      </div>
    </div>
  );
}
