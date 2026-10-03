import { describe, expect, it } from 'vitest';
import {
  REST,
  emptySchedule,
  normalizeSchedule,
  resolveToday,
  scheduledType,
  trainedTypeOn,
  weekStart,
} from '@/lib/schedule';

// Week of 2026-10-05 (Mon) … 2026-10-11 (Sun). 2026-10-05 is a Monday.
// schedule indexed by JS getDay(): 0=Sun..6=Sat
// Mon=Push, Tue=Pull, Wed=Rest, Thu=Legs, Fri=Push, Sat=Rest, Sun=Rest
const sched = [
  REST, // 0 Sun
  'Push', // 1 Mon
  'Pull', // 2 Tue
  REST, // 3 Wed
  'Legs', // 4 Thu
  'Push', // 5 Fri
  REST, // 6 Sat
];

const done = (date, type) => ({ date, type, exercises: [{ exerciseId: 'x', name: 'X' }] });

describe('schedule basics', () => {
  it('normalizes to 7 rest slots', () => {
    expect(normalizeSchedule(null)).toEqual(emptySchedule());
    expect(emptySchedule()).toHaveLength(7);
  });
  it('weekStart returns the Monday', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05'); // Wed → Mon
    expect(weekStart('2026-10-05')).toBe('2026-10-05'); // Mon → Mon
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sun → Mon
  });
  it('scheduledType reads the weekday slot', () => {
    expect(scheduledType(sched, '2026-10-05')).toBe('Push'); // Mon
    expect(scheduledType(sched, '2026-10-07')).toBe(REST); // Wed
  });
  it('trainedTypeOn ignores empty workouts', () => {
    const hist = [done('2026-10-05', 'Push'), { date: '2026-10-06', type: 'Pull', exercises: [] }];
    expect(trainedTypeOn(hist, '2026-10-05')).toBe('Push');
    expect(trainedTypeOn(hist, '2026-10-06')).toBeNull(); // empty = not trained
  });
});

describe('resolveToday — on schedule', () => {
  it('pre-sets today\u2019s scheduled type when nothing missed', () => {
    const r = resolveToday(sched, [], '2026-10-05'); // Mon, no history
    expect(r.type).toBe('Push');
    expect(r.due).toBe(false);
  });
  it('rest day stays rest', () => {
    const r = resolveToday(sched, [], '2026-10-07'); // Wed
    expect(r.type).toBe(REST);
  });
});

describe('resolveToday — catch-up queue', () => {
  it('slides a missed Monday Push onto Tuesday', () => {
    // Missed Mon (no history). Tuesday should suggest Push (the due session),
    // pushing Pull back.
    const r = resolveToday(sched, [], '2026-10-06'); // Tue, nothing done
    expect(r.type).toBe('Push');
    expect(r.due).toBe(true);
    expect(r.reason).toMatch(/missed/i);
  });
  it('after completing the slid session, next training day advances', () => {
    // Did Push on Tue (catching up Monday). Thursday (Wed is rest) → Pull is due.
    const hist = [done('2026-10-06', 'Push')];
    const r = resolveToday(sched, hist, '2026-10-08'); // Thu
    expect(r.type).toBe('Pull');
    expect(r.due).toBe(true); // Pull slid from Tue
  });
  it('on-time training keeps you on schedule', () => {
    // Did Push Mon → Tuesday is plain Pull, not due.
    const hist = [done('2026-10-05', 'Push')];
    const r = resolveToday(sched, hist, '2026-10-06'); // Tue
    expect(r.type).toBe('Pull');
    expect(r.due).toBe(false);
  });
});

describe('resolveToday — back-to-back guard', () => {
  it('never suggests the same type trained yesterday', () => {
    // Mon=Push, Tue=Push, Wed=Pull. You missed Monday, then trained Push on
    // Tuesday (catching up Monday's Push). On Wednesday the due (slid) session
    // is Tuesday's Push — but you JUST did Push yesterday, so the guard should
    // advance to the next differing queued session (Wed's Pull).
    const s2 = [REST, 'Push', 'Push', 'Pull', REST, REST, REST];
    //            Sun   Mon    Tue    Wed    Thu   Fri   Sat
    const hist = [done('2026-10-06', 'Push')]; // trained Push on Tue only
    const r = resolveToday(s2, hist, '2026-10-07'); // Wed
    expect(r.type).toBe('Pull');
    expect(r.adjusted).toBe(true);
    expect(r.reason).toMatch(/back-to-back/i);
  });
});
