// MuscleTag — a small colour-coded badge for an exercise's muscle group.
// Reused everywhere an exercise is listed (Library, picker, workout card, plan
// editor) so the colour coding is consistent. Renders nothing when there's no
// group. Colour + label come from the pure muscleGroups helper.

import { cn } from 'cn';
import { muscleMeta } from '@/lib/muscleGroups';

export function MuscleTag({ group, className }) {
  const meta = muscleMeta(group);
  if (!meta) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide',
        meta.badge,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
