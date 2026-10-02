// LibraryView — the Library tab: browse all exercises, one-tap add to today's
// workout, and create a new exercise (name + optional muscle group). Edit/delete
// come later. Adds go to the SHARED workout via WorkoutProvider.

import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';

export function LibraryView() {
  const { library, exercises, addExercise, createExercise, loading } = useWorkoutContext();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [justAdded, setJustAdded] = useState(null); // exerciseId → brief "added" flash

  const inWorkout = useMemo(() => new Set(exercises.map((e) => e.exerciseId)), [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? library.filter((e) => e.name.toLowerCase().includes(q)) : library;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [library, query]);

  const flashAdded = (id) => {
    setJustAdded(id);
    setTimeout(() => setJustAdded((cur) => (cur === id ? null : cur)), 1200);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const row = await createExercise({ name: newName, muscleGroup: newMuscle });
      flashAdded(row.id);
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
              {busy ? 'Adding…' : 'Create & add to today'}
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

      {/* List */}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {results.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {query ? 'No matches.' : 'No exercises yet — create one above.'}
          </li>
        )}
        {results.map((e) => {
          const added = inWorkout.has(e.id) || justAdded === e.id;
          return (
            <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <ExerciseThumb name={e.name} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">{e.name}</span>
                  {e.muscle_group && (
                    <span className="text-xs text-muted-foreground">{e.muscle_group}</span>
                  )}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant={added ? 'ghost' : 'outline'}
                disabled={added}
                onClick={() => {
                  addExercise(e);
                  flashAdded(e.id);
                }}
                className={cn('shrink-0', added && 'text-muted-foreground')}
              >
                {added ? (
                  <>
                    <Check className="size-4" /> Added
                  </>
                ) : (
                  <>
                    <Plus className="size-4" /> Add
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
