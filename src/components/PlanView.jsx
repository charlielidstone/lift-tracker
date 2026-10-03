// PlanView — the Plan tab: your weekly training schedule. Assign each weekday a
// workout TYPE or Rest. When you start a workout, Today pre-sets the resolved
// type (with catch-up for missed sessions — see schedule.js). Editing is instant
// and persisted via ScheduleProvider.

import { useEffect, useMemo, useState } from 'react';
import { cn } from 'cn';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { loadHistoryCache } from '@/lib/localCache';
import { fetchWorkoutHistory } from '@/lib/workoutRepo';
import { WORKOUT_TYPES, localToday } from '@/lib/defaults';
import { REST, WEEKDAY_LABELS, WEEKDAY_ORDER, resolveToday, scheduledType } from '@/lib/schedule';
import { useSchedule } from '@/hooks/ScheduleProvider';

const OPTIONS = [...WORKOUT_TYPES, REST];

// A date string in the CURRENT week for a given weekday index, so scheduledType
// (which reads getDay()) resolves the right slot. Only the weekday matters.
function dateForDow(dow) {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + (dow - now.getDay()));
  return localToday(d);
}

export function PlanView() {
  const { schedule, setDay } = useSchedule();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [history, setHistory] = useState([]);
  const [openDay, setOpenDay] = useState(null); // weekday index being edited

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    /* eslint-disable react/set-state-in-effect */
    const cached = loadHistoryCache(userId);
    if (cached) setHistory(cached);
    /* eslint-enable react/set-state-in-effect */
    (async () => {
      try {
        const data = await fetchWorkoutHistory();
        if (!cancelled) setHistory(data);
      } catch (e) {
        console.error('[PlanView] history load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const today = localToday();
  const todayDow = new Date().getDay();
  const suggestion = useMemo(
    () => resolveToday(schedule, history, today),
    [schedule, history, today],
  );
  const showScheduled = suggestion.scheduled !== suggestion.type;

  return (
    <div className="flex flex-col gap-3">
      {/* Today's resolved suggestion (with catch-up) */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Today</p>
        <p className="text-lg font-semibold text-foreground">{suggestion.type}</p>
        <p
          className={cn(
            'text-xs',
            suggestion.due || suggestion.adjusted
              ? 'text-amber-600 dark:text-amber-500'
              : 'text-muted-foreground',
          )}
        >
          {suggestion.reason}
          {showScheduled ? ` · scheduled ${suggestion.scheduled}` : ''}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Set each weekday. Starting a workout pre-sets today&apos;s type; miss one and the week
        shifts to catch you up without training the same type twice in a row.
      </p>

      <ul className="flex flex-col gap-2">
        {WEEKDAY_ORDER.map((dow) => {
          const type = scheduledType(schedule, dateForDow(dow));
          const isToday = dow === todayDow;
          const editing = openDay === dow;
          return (
            <li
              key={dow}
              className={cn(
                'rounded-lg border px-3 py-2.5',
                isToday ? 'border-accent' : 'border-border',
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2"
                onClick={() => setOpenDay(editing ? null : dow)}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {WEEKDAY_LABELS[dow]}
                  {isToday && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground">
                      Today
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    type === REST ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {type}
                </span>
              </button>

              {editing && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OPTIONS.map((opt) => {
                    const on = opt === type;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setDay(dow, opt);
                          setOpenDay(null);
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm',
                          on
                            ? 'border-transparent bg-accent text-accent-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
