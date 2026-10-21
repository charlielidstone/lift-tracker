// WeeklyMuscleSummary — on the Plan tab, between the weekday schedule and the
// session plans. Rolls your weekly schedule × session plans into target working
// sets per muscle group (primary group only) and shows colour-coded bars so it's
// obvious which muscles you're giving more / less volume. Pure maths lives in
// weeklySetsByMuscle; this just renders it.

import { useMemo } from 'react';
import { cn } from 'cn';
import { useSchedule } from '@/hooks/ScheduleProvider';
import { usePlans } from '@/hooks/PlansProvider';
import { weeklySetsByMuscle } from '@/lib/muscleGroups';

export function WeeklyMuscleSummary() {
  const { schedule } = useSchedule();
  const { plans } = usePlans();

  const { groups, total, daysPlanned } = useMemo(
    () => weeklySetsByMuscle(schedule, plans),
    [schedule, plans],
  );
  const max = groups.length ? groups[0].sets : 0;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Weekly volume</h2>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} sets · {daysPlanned} day{daysPlanned === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Target working sets per muscle each week, from your schedule × session plans.
      </p>

      {total === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Assign training days above and add exercises to each session plan below to see your
          weekly set volume per muscle.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-foreground">{g.label}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn('absolute inset-y-0 left-0 rounded-full', g.bar)}
                  style={{ width: `${max ? (g.sets / max) * 100 : 0}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {g.sets}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
