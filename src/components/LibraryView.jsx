// LibraryView — the Library tab: browse every exercise, favourite the ones you use,
// and create new ones. Favourites drive what shows in the Today screen's suggested
// list (and appear first when you search), so this tab is where you curate them.
// Adding an exercise to a workout still happens on the Today screen.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Star } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { MuscleTag } from '@/components/MuscleTag';
import { libraryExercises } from '@/lib/exerciseSort';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';

export function LibraryView() {
  const { library, favorites, toggleFavorite, createExercise, loading } = useWorkoutContext();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // The star fills/empties instantly (uses real `favorites`), but the row's SECTION
  // (favourites-first) is ordered by a lagged copy so a just-toggled row stays put
  // for a beat instead of jumping. Settles ~2s after the last toggle.
  const [sortFavs, setSortFavs] = useState(favorites);
  useEffect(() => {
    if (favorites === sortFavs) return undefined;
    // Initial load / feature (un)availability flips immediately — only user toggles lag.
    if (sortFavs === null || favorites === null) {
      /* eslint-disable-next-line react/set-state-in-effect */
      setSortFavs(favorites);
      return undefined;
    }
    const t = setTimeout(() => setSortFavs(favorites), 2000);
    return () => clearTimeout(t);
  }, [favorites, sortFavs]);

  const results = useMemo(
    () => libraryExercises(library, query, sortFavs),
    [library, query, sortFavs],
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createExercise({ name: newName, muscleGroup: newMuscle });
      setNewName('');
      setNewMuscle('');
      setCreating(false);
    } catch (e2) {
      setErr('Could not create — need a connection. Try again when online.');
      console.error('[LibraryView] create failed', e2);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading library…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Tap the star to favourite. Favourites show up when you add exercises on the
        Today screen (and appear first when you search).
      </p>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          inputMode="search"
          placeholder="Search your exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Create new */}
      {creating ? (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <Input
            autoFocus
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Muscle group (optional)"
            value={newMuscle}
            onChange={(e) => setNewMuscle(e.target.value)}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !newName.trim()}>
              {busy ? 'Saving…' : 'Create'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setErr(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4" /> New exercise
        </Button>
      )}

      {/* List — tap the star to favourite. Adding to a workout is on the Today screen. */}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {results.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {query ? 'No matches.' : 'No exercises yet — create one above.'}
          </li>
        )}
        {results.map((e) => {
          const fav = favorites?.has(e.id);
          return (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <ExerciseThumb name={e.name} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-foreground">{e.name}</span>
                {e.muscle_group && <MuscleTag group={e.muscle_group} className="self-start" />}
              </span>
              {favorites !== null && (
                <button
                  type="button"
                  onClick={() => toggleFavorite(e.id)}
                  aria-label={fav ? `Unfavourite ${e.name}` : `Favourite ${e.name}`}
                  aria-pressed={fav}
                  className="shrink-0 rounded-full p-1.5 hover:bg-muted"
                >
                  <Star
                    className={cn(
                      'size-5',
                      fav ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                    )}
                  />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
