import { describe, expect, it } from 'vitest';
import { weeklyStats, mondayOf } from '@/lib/weeklyStats';

describe('mondayOf', () => {
  it('returns the Monday on or before a date', () => {
    expect(mondayOf('2026-10-05')).toBe('2026-10-05'); // Mon
    expect(mondayOf('2026-10-07')).toBe('2026-10-05'); // Wed → that Mon
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sun → prior Mon
  });
});

const history = [
  // week of Mon Oct 5
  { date: '2026-10-05', exercises: [{ sets: [{ weight: 100, reps: 5 }] }] }, // vol 500
  { date: '2026-10-07', exercises: [{ sets: [{ weight: 100, reps: 5 }] }] }, // vol 500
  // week of Mon Sep 28
  { date: '2026-09-29', exercises: [{ sets: [{ weight: 200, reps: 3 }] }] }, // vol 600
  // empty day — ignored
  { date: '2026-10-06', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
  // far outside a 4-week window
  { date: '2026-01-01', exercises: [{ sets: [{ weight: 50, reps: 5 }] }] },
];

const TODAY = '2026-10-08'; // Thursday of week of Mon Oct 5

describe('weeklyStats', () => {
  const weeks = weeklyStats(history, 4, TODAY);

  it('returns exactly N weeks, oldest-first, ending with the current week', () => {
    expect(weeks).toHaveLength(4);
    expect(weeks[0].weekStart).toBe('2026-09-14');
    expect(weeks[3].weekStart).toBe('2026-10-05');
  });

  it('buckets workouts into Monday-based weeks', () => {
    expect(weeks[3].workouts).toBe(2); // Oct 5 + Oct 7
    expect(weeks[2].workouts).toBe(1); // Sep 29 (week of Sep 28)
  });

  it('sums volume per week (lb·reps), ignoring empty sets', () => {
    expect(weeks[3].volume).toBe(1000); // 500 + 500
    expect(weeks[2].volume).toBe(600);
  });

  it('includes empty weeks with zeroes', () => {
    expect(weeks[0]).toMatchObject({ workouts: 0, volume: 0 });
    expect(weeks[1]).toMatchObject({ workouts: 0, volume: 0 });
  });

  it('excludes sessions outside the window', () => {
    expect(weeks.some((w) => w.weekStart === '2025-12-29')).toBe(false);
    const total = weeks.reduce((n, w) => n + w.workouts, 0);
    expect(total).toBe(3); // Jan 1 excluded
  });

  it('attaches a short month-day label', () => {
    expect(weeks[3].label).toBe('Oct 5');
  });

  it('is safe on empty/null input', () => {
    const z = weeklyStats(null, 4, TODAY);
    expect(z).toHaveLength(4);
    expect(z.every((w) => w.workouts === 0 && w.volume === 0)).toBe(true);
  });
});
