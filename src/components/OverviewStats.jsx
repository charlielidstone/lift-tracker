// OverviewStats — headline training stats at the top of the Progress tab.
// A compact grid of stat tiles (gym days, this week/month, streak, totals).
// Pure presentation; takes the already-computed stats + display unit.

import { toDisplayWeight, unitLabel } from '@/lib/units';

function Stat({ label, value, sub }) {
  return (
    <div className="flex flex-col rounded-lg border border-border px-3 py-2.5">
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// Compact a big number: 12345 → '12.3k'.
function compact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function OverviewStats({ stats, unit }) {
  if (!stats || stats.gymDays === 0) return null;

  const volDisplay = compact(toDisplayWeight(stats.totalVolume, unit));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Gym days" value={stats.gymDays} />
        <Stat
          label="Week streak"
          value={stats.weekStreak}
          sub={stats.weekStreak === 1 ? 'week' : 'weeks in a row'}
        />
        <Stat label="This week" value={stats.thisWeek} sub="last 7 days" />
        <Stat label="This month" value={stats.thisMonth} sub="last 30 days" />
        <Stat label="Total sets" value={stats.totalSets} />
        <Stat label="Total volume" value={volDisplay} sub={`${unitLabel(unit)}·reps`} />
      </div>
      <p className="text-xs text-muted-foreground">
        {stats.avgPerWeek} sessions/week avg
        {stats.topExercise ? ` · most trained: ${stats.topExercise.name}` : ''}
      </p>
    </div>
  );
}
