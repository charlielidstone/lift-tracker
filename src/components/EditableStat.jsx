// EditableStat — a single set value (weight/reps/rpe) with tap-to-edit.
// Collapsed: a compact chip showing "{value} {label}". Tapping it reveals the
// full Stepper (+/- icons) as an OVERLAY on top of the row — the chip keeps its
// slot so the row layout never shifts; the stepper floats over its neighbors.
// (design philosophy: fit the phone, adjust in place, no reflow)
//
// Props:
//   label     string   — unit label ("lb", "reps", "RPE")
//   value     number
//   step/min/max        — passed through to Stepper
//   active    boolean   — is this stat expanded into a Stepper?
//   onActivate () => void  — toggle open/closed
//   onChange  (next:number) => void

import { Stepper } from '@/components/Stepper';

export function EditableStat({ label, value, step, min, max, active, onActivate, onChange }) {
  return (
    <div className="relative shrink-0">
      {/* Collapsed chip — always rendered to reserve layout space (no reflow). */}
      <button
        type="button"
        onClick={onActivate}
        aria-label={`Edit ${label}`}
        aria-hidden={active}
        className={`flex items-center gap-1 bg-muted px-3 py-2 rounded-2xl ${active ? 'invisible' : ''}`}
      >
        <span className="text-foreground tabular-nums font-medium">{value}</span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </button>

      {/* Active editor — overlays on top, centered over the chip, floats over neighbors. */}
      {active && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 origin-center animate-in zoom-in-75 fade-in duration-100 ease-out">
          <Stepper
            label={label}
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={onChange}
            onValueClick={onActivate}
            valueClassName="text-xl font-semibold"
          />
        </div>
      )}
    </div>
  );
}
