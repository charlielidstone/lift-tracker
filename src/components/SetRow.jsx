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

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { EditableStat } from '@/components/EditableStat';
import { Button } from '@/components/ui/button';
import { STEP, BOUNDS } from '@/lib/defaults';

export function SetRow({ set, onChange, onDelete, index, readOnly }) {
  // Which stat is expanded into a Stepper (only one at a time). null = all collapsed.
  const [activeField, setActiveField] = useState(null);
  const rowRef = useRef(null);

  // Toggle a stat open/closed. Tapping the open one (or its number) collapses it.
  const toggleField = (field) => setActiveField((cur) => (cur === field ? null : field));

  // Collapse when the user taps anywhere outside this row.
  useEffect(() => {
    if (!activeField) return;
    const onPointerDown = (e) => {
      if (!rowRef.current?.contains(e.target)) setActiveField(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [activeField]);

  return (
    <div ref={rowRef} className="flex justify-start items-center gap-2 m-1">
      <span className="w-5 shrink-0">{index}.</span>
      <EditableStat
        label="lb"
        value={set.weight}
        step={STEP.weight}
        min={BOUNDS.weight.min}
        max={BOUNDS.weight.max}
        active={activeField === 'weight'}
        onActivate={() => toggleField('weight')}
        onChange={(v) => onChange({ weight: v })}
        readOnly={readOnly}
      />
      <EditableStat
        label="reps"
        value={set.reps}
        step={STEP.reps}
        min={BOUNDS.reps.min}
        max={BOUNDS.reps.max}
        active={activeField === 'reps'}
        onActivate={() => toggleField('reps')}
        onChange={(v) => onChange({ reps: v })}
        readOnly={readOnly}
      />
      <EditableStat
        label="RPE"
        value={set.rpe}
        step={STEP.rpe}
        min={BOUNDS.rpe.min}
        max={BOUNDS.rpe.max}
        active={activeField === 'rpe'}
        onActivate={() => toggleField('rpe')}
        onChange={(v) => onChange({ rpe: v })}
        readOnly={readOnly}
      />
      {!readOnly && (
        <Button
          type="button"
          size="icon"
          onClick={onDelete}
          aria-label={`Delete set ${index}`}
          className="shrink-0 bg-destructive text-white hover:bg-destructive/90 ml-auto"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
