// StrengthStandards — the "where should I be?" benchmark on the Progress tab.
// For each of the big-4 lifts, a horizontal Beginner→Elite band bar with a marker
// at your best estimated 1RM, rated against bodyweight/sex/age standards.
//
// Needs a body profile (Settings → Body profile); prompts to set one up if empty.
// All weight math is canonical lb; display converts via the unit pref.

import { useMemo } from 'react';
import { useSettings } from '@/hooks/SettingsProvider';
import { toDisplayWeight, unitLabel } from '@/lib/units';
import {
  LEVELS,
  STANDARD_LIFTS,
  thresholdsFor,
  rateLift,
  bestE1rmByLift,
} from '@/lib/strengthStandards';

// Full literal Tailwind classes (JIT purges assembled names) — one per band.
const BAND_BG = {
  Beginner: 'bg-slate-200',
  Novice: 'bg-sky-200',
  Intermediate: 'bg-emerald-200',
  Advanced: 'bg-violet-200',
  Elite: 'bg-amber-200',
};
const BAND_DOT = {
  Beginner: 'bg-slate-400',
  Novice: 'bg-sky-400',
  Intermediate: 'bg-emerald-400',
  Advanced: 'bg-violet-400',
  Elite: 'bg-amber-400',
};
const BADGE = {
  Beginner: 'bg-slate-100 text-slate-700',
  Novice: 'bg-sky-100 text-sky-700',
  Intermediate: 'bg-emerald-100 text-emerald-700',
  Advanced: 'bg-violet-100 text-violet-700',
  Elite: 'bg-amber-100 text-amber-700',
};

function round(v) {
  return Math.round(v);
}

export function StrengthStandards({ history }) {
  const { unit, profile } = useSettings();
  const ready = profile.bodyweightLb != null && !!profile.sex;

  const best = useMemo(() => bestE1rmByLift(history), [history]);

  const rows = useMemo(() => {
    if (!ready) return [];
    return STANDARD_LIFTS.map((lift) => {
      const thresholds = thresholdsFor(lift.id, profile);
      const data = best[lift.id];
      const e1rm = data?.e1rm ?? null;
      const rating = e1rm != null ? rateLift(e1rm, thresholds) : null;
      return { lift, e1rm, rating, hasData: e1rm != null };
    });
  }, [ready, profile, best]);

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Add your <span className="font-medium text-foreground">bodyweight and sex</span> in
        Settings → Body profile to see where your lifts stand against population strength
        standards.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Strength standards</p>
        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {LEVELS.map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1">
              <span className={`inline-block size-2 rounded-full ${BAND_DOT[lvl]}`} />
              <span className="text-[10px] text-muted-foreground">{lvl}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(({ lift, e1rm, rating, hasData }) => {
          const pct = rating ? Math.round(rating.position * 100) : 0;
          return (
            <div key={lift.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{lift.label}</span>
                {hasData ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rating.level ? BADGE[rating.level] : 'bg-muted text-muted-foreground'}`}
                  >
                    {rating.level ?? 'Below Beginner'}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not logged yet</span>
                )}
              </div>

              {/* band bar */}
              <div className="relative h-3 w-full overflow-hidden rounded-full">
                <div className="flex h-full w-full">
                  {LEVELS.map((lvl) => (
                    <div key={lvl} className={`h-full flex-1 ${BAND_BG[lvl]}`} />
                  ))}
                </div>
                {hasData && (
                  <div
                    className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pct}%` }}
                  >
                    <div className="size-4 rounded-full border-2 border-background bg-foreground shadow" />
                  </div>
                )}
              </div>

              {/* caption */}
              {hasData ? (
                <p className="text-[11px] text-muted-foreground">
                  You: <span className="font-medium text-foreground">
                    {round(toDisplayWeight(e1rm, unit))} {unitLabel(unit)}
                  </span>{' '}
                  est. 1RM
                  {rating.nextLevel && (
                    <>
                      {' · '}
                      {round(toDisplayWeight(rating.toNext, unit))} {unitLabel(unit)} to{' '}
                      {rating.nextLevel}
                    </>
                  )}
                  {!rating.nextLevel && rating.level === 'Elite' && ' · top of the scale 💪'}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Log {lift.label} to see where it stands.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        Approximate — bodyweight-multiple standards (sex &amp; age adjusted), from a best est. 1RM
        across your history. Faithful tables vary by bodyweight class, so treat these as a guide.
      </p>
    </div>
  );
}
