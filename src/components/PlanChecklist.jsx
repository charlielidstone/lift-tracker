// PlanChecklist — on Today, shows the planned exercises for the current workout
// type as an UNORDERED checklist: target sets × rep-range (+ RPE), live progress
// toward the target, and an "add weight" nudge when you beat the plan.
//
// Tapping an un-started planned exercise adds it to today's workout so you can log
// it (opens an ExerciseCard below). Order is deliberately irrelevant — do them in
// whatever order a machine is free.

import { Check, Plus, TrendingUp } from 'lucide-react';
import { cn } from 'cn';
import { planChecklist, planSummary, formatRepRange } from '@/lib/planProgress';

export function PlanChecklist({ plan, exercises, inWorkoutIds = [], onAdd }) {
  if (!plan || plan.exercises.length === 0) return null;

  const checklist = planChecklist(plan, exercises);
  const summary = planSummary(checklist);
  const inWorkout = new Set(inWorkoutIds);

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {plan.type} plan
        </p>
        <p className={cn('text-xs', summary.allDone ? 'text-emerald-600' : 'text-muted-foreground')}>
          {summary.complete}/{summary.total} done
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {checklist.map((c) => {
          const added = inWorkout.has(c.exerciseId);
          return (
            <li
              key={c.exerciseId}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
            >
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'truncate text-sm',
                    c.met ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  {c.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.targetSets} × {formatRepRange(c.repMin, c.repMax)} reps
                  {c.rpe != null ? ` @${c.rpe}` : ''}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                {c.addWeight && (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
                    <TrendingUp className="size-3.5" /> add weight
                  </span>
                )}
                {c.met ? (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                    <Check className="size-4" />
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {c.doneSets}/{c.targetSets}
                  </span>
                )}
                {!added && (
                  <button
                    type="button"
                    aria-label={`Add ${c.name} to today`}
                    onClick={() => onAdd?.({ id: c.exerciseId, name: c.name })}
                    className="rounded-full border border-border p-1 text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
