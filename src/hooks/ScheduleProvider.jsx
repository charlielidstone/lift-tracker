// ScheduleProvider — the user's weekly training schedule: each weekday (0=Sun…
// 6=Sat) assigned a workout TYPE or REST. Persisted to localStorage. Any screen
// can read it (the Plan tab edits it; Today reads it to pre-set the type).
// No server sync in v1 — a schedule is a lightweight personal template.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { emptySchedule, normalizeSchedule } from '@/lib/schedule';

const ScheduleContext = createContext(null);
const KEY = 'lift-tracker:v1:schedule';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySchedule();
    return normalizeSchedule(JSON.parse(raw));
  } catch {
    return emptySchedule();
  }
}

export function ScheduleProvider({ children }) {
  const [schedule, setSchedule] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(schedule));
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, [schedule]);

  // Set one weekday's type (dayIndex 0=Sun…6=Sat).
  const setDay = useCallback((dayIndex, type) => {
    setSchedule((prev) => {
      const next = normalizeSchedule(prev);
      next[dayIndex] = type;
      return next;
    });
  }, []);

  return (
    <ScheduleContext.Provider value={{ schedule, setDay }}>{children}</ScheduleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
