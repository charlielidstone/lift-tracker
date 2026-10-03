// schedule.js — a weekly training schedule with catch-up.
//
// The user assigns each weekday a workout TYPE (from WORKOUT_TYPES) or REST.
// When they start a workout, today's type is pre-set from the schedule — but if
// they missed earlier sessions this week, the missed one is "due" instead and
// everything slides forward (catch-up queue), never training the same type two
// days in a row. Rest days stay rest; catch-up lands on the next TRAINING day.
//
// Pure, no React. Persistence lives in ScheduleProvider.
//
// Schedule shape: an array of 7 slots indexed by JS getDay() (0=Sun … 6=Sat),
// each a type string or REST. localToday-style 'YYYY-MM-DD' dates throughout.

import { localToday } from '@/lib/defaults';

export const REST = 'Rest';

// Monday-first weekday order for display, mapped to JS getDay() indexes.
// [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
export const WEEKDAY_SHORT = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

// A fresh all-rest schedule.
export function emptySchedule() {
  return [REST, REST, REST, REST, REST, REST, REST];
}

// Normalize whatever is stored into a valid 7-slot array.
export function normalizeSchedule(schedule) {
  const base = emptySchedule();
  if (!Array.isArray(schedule)) return base;
  for (let i = 0; i < 7; i += 1) base[i] = schedule[i] || REST;
  return base;
}

export function isRest(type) {
  return !type || type === REST;
}

// Parse 'YYYY-MM-DD' to a local Date (midnight). Avoids UTC parsing drift.
function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const dt = parseLocal(dateStr);
  dt.setDate(dt.getDate() + n);
  return localToday(dt);
}

// Monday of the week containing `dateStr` (ISO week start), as 'YYYY-MM-DD'.
export function weekStart(dateStr) {
  const dt = parseLocal(dateStr);
  const dow = dt.getDay(); // 0=Sun..6=Sat
  const backToMonday = (dow + 6) % 7; // Sun→6, Mon→0, Tue→1, …
  return addDays(dateStr, -backToMonday);
}

// The raw scheduled type for a date's weekday (REST if none).
export function scheduledType(schedule, dateStr) {
  const s = normalizeSchedule(schedule);
  return s[parseLocal(dateStr).getDay()] || REST;
}

// Did the user actually train (a non-empty, logged session) on this date?
// A session counts as done only if it has at least one exercise — an empty
// auto-created "today" workout does NOT count as completing a scheduled day.
export function trainedTypeOn(history, dateStr) {
  const w = (history ?? []).find((x) => x.date === dateStr && (x.exercises?.length ?? 0) > 0);
  return w ? (w.type ?? null) : null;
}

// Resolve what the user should train on `date`, accounting for catch-up.
// Returns { type, scheduled, due, adjusted, reason }:
//   type       — suggested type to pre-set (may be REST)
//   scheduled  — the raw schedule entry for today
//   due         — true if today's suggestion is a slid-forward missed session
//   adjusted   — true if the back-to-back guard changed the pick
//   reason     — short human string for the UI
export function resolveToday(schedule, history, date = localToday()) {
  const s = normalizeSchedule(schedule);
  const scheduled = scheduledType(s, date);

  // Rest days stay rest — catch-up only happens on training days.
  if (isRest(scheduled)) {
    return { type: REST, scheduled: REST, due: false, adjusted: false, reason: 'Rest day' };
  }

  // Build this week's planned training queue (Mon → today inclusive), in order.
  const start = weekStart(date);
  const queue = [];
  for (let cursor = start; cursor <= date; cursor = addDays(cursor, 1)) {
    const t = scheduledType(s, cursor);
    if (!isRest(t)) queue.push({ date: cursor, type: t });
  }

  // Completed training sessions earlier this week consume the queue from the
  // front (each finished day knocks out the oldest planned session).
  let completed = 0;
  for (let cursor = start; cursor < date; cursor = addDays(cursor, 1)) {
    if (trainedTypeOn(history, cursor)) completed += 1;
  }

  // The due session = the first still-unconsumed planned session.
  const dueIdx = Math.min(completed, queue.length - 1);
  let pick = queue[dueIdx];
  const isDue = pick.date !== date; // a slid-forward earlier session

  // Back-to-back guard: never the same type as what was actually trained
  // yesterday. If the due pick clashes, advance to the next differing session.
  const yesterday = trainedTypeOn(history, addDays(date, -1));
  let adjusted = false;
  if (yesterday && pick.type === yesterday) {
    const alt = queue.slice(dueIdx + 1).find((q) => q.type !== yesterday);
    if (alt) {
      pick = alt;
      adjusted = true;
    }
  }

  let reason = 'On schedule';
  if (adjusted) reason = `Shifted off back-to-back ${yesterday}`;
  else if (isDue) reason = 'Catching up a missed session';

  return { type: pick.type, scheduled, due: isDue, adjusted, reason };
}
