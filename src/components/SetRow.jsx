// SetRow — one logged set within an exercise.
// Shows weight / reps / RPE, each adjusted in place via a Stepper. Plus a delete button.
// No expanding — everything is adjustable right here (design philosophy: adjust in place).
//
// A "set" object shape (see docs/DECISIONS.md data model):
//   { id, weight, reps, rpe }   — set_order is derived from array position for now
//
// Props:
//   set       object   — { id, weight, reps, rpe }
//   onChange  (patch:object) => void  — e.g. onChange({ weight: 105 }) to update one field
//   onDelete  () => void
//
// TODO (Charlie):
//   - render three Steppers: weight (label "lb"), reps (label "reps"), rpe (label "RPE")
//   - wire each Stepper's onChange to call onChange({ <field>: nextValue })
//   - pull step sizes + bounds from '@/lib/defaults' (STEP, BOUNDS) — don't hardcode
//   - a delete control (shadcn Button, variant ghost/destructive) → calls onDelete
//   - lay it out as a single tidy row for phone width

import { Stepper } from '@/components/Stepper';
import { STEP, BOUNDS } from '@/lib/defaults';

export function SetRow({ set, onChange, onDelete, index }) {
  return (
    <div className="flex justify-start items-center gap-2 m-1 w-max">
      <span className="w-5 shrink-0">{index}.</span>
      <Stepper label="lb" value={set.weight} step={STEP.weight} min={BOUNDS.weight.min} max={BOUNDS.weight.max} onChange={(v) => onChange({ weight: v })} />
      <Stepper label="reps" value={set.reps} step={STEP.reps} min={BOUNDS.reps.min} max={BOUNDS.reps.max} onChange={(v) => onChange({ reps: v })} />
      <Stepper label="RPE" value={set.rpe} step={STEP.rpe} min={BOUNDS.rpe.min} max={BOUNDS.rpe.max} onChange={(v) => onChange({ rpe: v })} />
      <button
        type="button"
        className="text-foreground hover:text-destructive/80 transition-colors shrink-0"
        onClick={onDelete}
        aria-label={`Delete set ${index}`}
      >
        Delete
      </button>
    </div>
  );
}
