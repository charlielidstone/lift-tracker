// Stepper — reusable atom: a label, a value, and [–]/[+] buttons.
// The core low-friction control: every adjustable number (weight/reps/rpe) uses this.
// Pure + presentational — holds NO state itself; parent owns the value (controlled component).
//
// Props:
//   label    string   — shown next to the value (e.g. "lb", "reps", "RPE")
//   value    number   — current value (controlled by parent)
//   step     number   — how much one tap adds/subtracts
//   min      number   — lower clamp (optional)
//   max      number   — upper clamp (optional)
//   onChange (next:number) => void  — called with the new clamped value on tap
//
// TODO (Charlie):
//   - render: [–]  {value} {label}  [+]
//   - decrement: onChange(clamp(value - step)); increment: onChange(clamp(value + step))
//   - clamp against min/max so we never go out of bounds
//   - big tap targets (this is used mid-workout on a phone) — use the shadcn Button
//     (import { Button } from '@/components/ui/button') sized generously, e.g. size icon
//   - consider press-and-hold to repeat later; not needed for v1

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clamp } from '@/lib/clamp';

export function Stepper({ label, value, step, min, max, onChange, onValueClick, valueClassName = '' }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-muted px-3 py-2 w-fit rounded-2xl shadow-lg">
      <Button
        type="button"
        size="icon"
        onClick={() => onChange(clamp(value - step, min, max))}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" />
      </Button>
      <button
        type="button"
        onClick={onValueClick}
        aria-label={onValueClick ? `Collapse ${label}` : undefined}
        className="w-15 flex justify-center items-center"
      >
        <span className={`w-fit h-fit pr-1 text-right flex items-center justify-center text-foreground tabular-nums bg-muted rounded-md ${valueClassName}`}>{value}</span>
        <h3 className="h-fit text-muted-foreground">{label}</h3>
      </button>
      <Button
        type="button"
        size="icon"
        onClick={() => onChange(clamp(value + step, min, max))}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
