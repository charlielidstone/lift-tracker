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

import { Button } from '@/components/ui/button';
import { clamp } from '@/lib/clamp';

export function Stepper({ label, value, step, min, max, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-muted p-3 w-fit rounded-2xl">
      <h3 className="h-fit text-muted-foreground">{label}</h3>
      <Button
        type="button"
        size="icon"
        onClick={() => onChange(clamp(value - step, min, max))}
        aria-label={`Decrease ${label}`}
      >
        −
      </Button>
      <span className="w-8 h-8 text-center flex items-center justify-center text-foreground tabular-nums bg-muted rounded-md">{value}</span>
      <Button
        type="button"
        size="icon"
        onClick={() => onChange(clamp(value + step, min, max))}
        aria-label={`Increase ${label}`}
      >
        +
      </Button>
    </div>
  );
}
