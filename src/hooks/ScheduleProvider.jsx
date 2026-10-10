// ScheduleProvider — the user's weekly training schedule: each weekday (0=Sun…
// 6=Sat) assigned a workout TYPE or REST. Any screen can read it (the Plan tab
// edits it; Today reads it to pre-set the type).
//
// DURABLE local-first + server sync (same outbox pattern as PlansProvider), so
// the schedule is the SAME on every device and survives offline edits:
//   edit → React state → write-through localStorage cache → debounced upsert to
//   Supabase; offline edits stay cached and flush on reconnect. A separate SYNCED
//   BASELINE (last server-confirmed array, also persisted) is the outbox baseline,
//   so a pending edit = schedulesEqual(desired, synced) is false and survives a reload.
//
// Reconcile rule (mirrors PlansProvider/useWorkout): on load, adopt the SERVER
// copy UNLESS the cached desired differs from the synced baseline — i.e. there's a
// genuine un-synced local edit. Comparing against the server instead would mistake
// an out-of-band DB edit (e.g. a CLI change) for a local edit and freeze a stale copy.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { emptySchedule, normalizeSchedule, schedulesEqual } from '@/lib/schedule';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  loadScheduleCache,
  loadScheduleSynced,
  saveScheduleCache,
  saveScheduleSynced,
} from '@/lib/localCache';
import { fetchSchedule, saveSchedule } from '@/lib/scheduleRepo';

const ScheduleContext = createContext(null);
const SAVE_DEBOUNCE_MS = 700;

export function ScheduleProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [schedule, setSchedule] = useState(emptySchedule);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingSync, setPendingSync] = useState(false);

  const savedRef = useRef(emptySchedule()); // synced baseline (last server-confirmed)
  const scheduleRef = useRef(schedule); // latest desired state for reconnect flush
  const hydratedRef = useRef(false);
  const timerRef = useRef(null);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  // Persist the synced baseline in memory AND to localStorage so the outbox
  // baseline survives an offline reload (else a local edit looks already-saved).
  const commitSynced = useCallback(
    (snap) => {
      const norm = normalizeSchedule(snap);
      savedRef.current = norm;
      saveScheduleSynced(userId, norm);
    },
    [userId],
  );

  // ── Initial load: cache first (instant, offline-safe), then server ──
  useEffect(() => {
    let cancelled = false;

    /* eslint-disable react/set-state-in-effect */
    const cached = loadScheduleCache(userId);
    const cachedSynced = loadScheduleSynced(userId);
    if (cached) setSchedule(normalizeSchedule(cached));
    // Baseline = last server-confirmed snapshot (NOT desired). When absent (first
    // run / legacy migration) it's empty, so an existing local schedule counts as
    // a pending edit and gets pushed to the server rather than silently dropped.
    savedRef.current = cachedSynced ? normalizeSchedule(cachedSynced) : emptySchedule();
    /* eslint-enable react/set-state-in-effect */
    hydratedRef.current = true;

    if (!isSupabaseConfigured) return undefined;

    (async () => {
      try {
        const data = await fetchSchedule(); // null when no row yet
        if (cancelled) return;
        // Adopt the server copy UNLESS there's a genuine un-synced LOCAL edit
        // (cached desired differs from the synced baseline).
        const localEdits = cached
          ? !schedulesEqual(normalizeSchedule(cached), savedRef.current)
          : false;
        if (data && !localEdits) setSchedule(normalizeSchedule(data));
        // Baseline becomes what the SERVER actually holds (empty if no row yet),
        // so a local-only schedule stays pending and the debounced flush pushes it.
        commitSynced(data ?? emptySchedule());
      } catch (e) {
        // Offline / table missing (migration not run yet): keep the cached copy.
        console.error('[ScheduleProvider] load failed (using cache)', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, commitSynced]);

  // ── Flush the pending edit to the server (debounce + reconnect) ──
  const flush = useCallback(async () => {
    if (!isSupabaseConfigured) return { ok: true, pending: false };
    const desired = normalizeSchedule(scheduleRef.current);
    if (schedulesEqual(desired, savedRef.current)) {
      setPendingSync(false);
      return { ok: true, pending: false };
    }
    try {
      await saveSchedule(desired);
      commitSynced(desired); // baseline advances only after the write succeeds
      setPendingSync(false);
      return { ok: true, pending: false };
    } catch (e) {
      setPendingSync(true); // keep pending; reconnect/next edit retries
      console.error('[ScheduleProvider] flush failed (will retry)', e);
      return { ok: false, pending: true };
    }
  }, [commitSynced]);

  // Debounced auto-save whenever the schedule changes (after hydration).
  useEffect(() => {
    if (!isSupabaseConfigured || !hydratedRef.current) return undefined;
    setPendingSync(!schedulesEqual(normalizeSchedule(schedule), savedRef.current));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [schedule, flush]);

  // Write-through cache on every change (independent of the debounced flush).
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveScheduleCache(userId, schedule);
  }, [schedule, userId]);

  // Online/offline: reflect status and drain the outbox on reconnect.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

  // Set one weekday's type (dayIndex 0=Sun…6=Sat). Optimistic; the flush persists.
  const setDay = useCallback((dayIndex, type) => {
    setSchedule((prev) => {
      const next = normalizeSchedule(prev);
      next[dayIndex] = type;
      return next;
    });
  }, []);

  return (
    <ScheduleContext.Provider value={{ schedule, setDay, online, pendingSync }}>
      {children}
    </ScheduleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
