// PlanView — the Plan tab: define your gym split as named days, each mapped to
// muscle groups (e.g. Push → chest, shoulders, arms). When today's workout TYPE
// matches a day's name, the Today chips boost that day's muscle groups.
// Planning only — no auto-loading of exercises (manual adding stays).

import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSplit } from '@/hooks/SplitProvider';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';
import { MUSCLE_GROUPS, newDay, validateDay } from '@/lib/split';

function DayEditor({ initial, split, library, onSave, onCancel }) {
  const [name, setName] = useState(initial.name);
  const [groups, setGroups] = useState(initial.muscleGroups);
  const [err, setErr] = useState(null);

  // Offer the standard groups unioned with any actually in the library.
  const options = useMemo(() => {
    const fromLib = (library ?? [])
      .map((e) => (e.muscle_group ? String(e.muscle_group).toLowerCase() : null))
      .filter(Boolean);
    return [...new Set([...MUSCLE_GROUPS, ...fromLib])];
  }, [library]);

  const toggle = (g) =>
    setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const save = () => {
    const day = { ...initial, name: name.trim(), muscleGroups: groups };
    const error = validateDay(split, day);
    if (error) {
      setErr(error);
      return;
    }
    onSave(day);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Input
        autoFocus
        placeholder="Day name (e.g. Push)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Muscle groups</span>
        <div className="flex flex-wrap gap-1.5">
          {options.map((g) => {
            const on = groups.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggle(g)}
                aria-pressed={on}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm capitalize',
                  on
                    ? 'border-transparent bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!name.trim()}>
          Save day
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PlanView() {
  const { split, saveDay, deleteDay } = useSplit();
  const { library } = useWorkoutContext();
  const [editingId, setEditingId] = useState(null); // day id, 'new', or null

  const startNew = () => setEditingId('new');
  const editing =
    editingId === 'new'
      ? newDay()
      : split.find((d) => d.id === editingId) ?? null;

  const handleSave = (day) => {
    saveDay(day);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Build your split as named days. When today's workout type matches a day, its muscle
        groups drive the suggested exercises.
      </p>

      {editingId ? (
        <DayEditor
          initial={editing}
          split={split}
          library={library}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <Button type="button" variant="outline" className="justify-start" onClick={startNew}>
          <Plus className="size-4" /> New day
        </Button>
      )}

      {split.length === 0 && !editingId && (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No days yet. Add one like “Push” → chest, shoulders, arms.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {split.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">{d.name}</span>
              <span className="truncate text-xs capitalize text-muted-foreground">
                {d.muscleGroups.length ? d.muscleGroups.join(', ') : 'no muscle groups'}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Edit ${d.name}`}
                onClick={() => setEditingId(d.id)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Delete ${d.name}`}
                onClick={() => deleteDay(d.id)}
                className="text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
