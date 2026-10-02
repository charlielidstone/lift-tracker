// ExercisePicker — a styled, searchable exercise picker (NOT a browser-default
// <select>). Tap to open a filterable list; tap a result to add it to today.
// Used on the Today screen as the "add any exercise" backup below the chips.

import { useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';

export function ExercisePicker({ library, onPick, inWorkoutIds = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? library.filter((e) => e.name.toLowerCase().includes(q))
      : library;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [library, query]);

  const inWorkout = new Set(inWorkoutIds);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-muted-foreground"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className="size-4" /> Add any exercise…
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Close search"
          onClick={() => {
            setOpen(false);
            setQuery('');
          }}
        >
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto py-1">
        {results.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
        )}
        {results.map((e) => {
          const added = inWorkout.has(e.id);
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={added}
                onClick={() => {
                  onPick(e);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                  added ? 'cursor-default text-muted-foreground' : 'hover:bg-muted',
                )}
              >
                <span className="flex flex-col">
                  <span className="text-foreground">{e.name}</span>
                  {e.muscle_group && (
                    <span className="text-xs text-muted-foreground">{e.muscle_group}</span>
                  )}
                </span>
                {added ? (
                  <span className="text-xs">added ✓</span>
                ) : (
                  <Plus className="size-4 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
