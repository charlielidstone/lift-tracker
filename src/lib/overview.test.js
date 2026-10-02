import { describe, expect, it } from 'vitest';
import { overviewStats } from '@/lib/overview';

const history = [
  {
    date: '2026-10-01',
    exercises: [
      { exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 155, reps: 5 }, { weight: 165, reps: 3 }] },
      { exerciseId: 'squat', name: 'Squat', sets: [{ weight: 225, reps: 5 }] },
    ],
  },
  {
    date: '2026-09-29',
    exercises: [{ exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 145, reps: 8 }] }],
  },
  {
    date: '2026-09-22',
    exercises: [{ exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 135, reps: 8 }] }],
  },
  // empty day — ignored
  { date: '2026-09-20', exercises: [{ exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 0, reps: 0 }] }] },
];

const TODAY = '2026-10-02';

describe('overviewStats', () => {
  const s = overviewStats(history, TODAY);

  it('counts only gym days with real sets', () => {
    expect(s.gymDays).toBe(3); // Sep 20 excluded
  });
  it('totals sets and volume (lb·reps)', () => {
    expect(s.totalSets).toBe(5); // 2 + 1 + 1 + 1
    expect(s.totalVolume).toBe(155 * 5 + 165 * 3 + 225 * 5 + 145 * 8 + 135 * 8);
  });
  it('counts sessions this week (last 7 days) and this month (last 30)', () => {
    expect(s.thisWeek).toBe(2); // Oct 1 + Sep 29 (Sep 22 is 10 days back)
    expect(s.thisMonth).toBe(3);
  });
  it('reports first/last trained dates', () => {
    expect(s.firstDate).toBe('2026-09-22');
    expect(s.lastDate).toBe('2026-10-01');
  });
  it('identifies the most-trained exercise', () => {
    expect(s.topExercise).toEqual({ name: 'Bench Press', sessions: 3 });
  });
  it('computes avg sessions per week over the trained span', () => {
    // 3 sessions over a 10-day span (Sep 22 → Oct 1) = 2.1/week
    expect(s.avgPerWeek).toBeCloseTo(2.1, 1);
  });
  it('counts a current week streak', () => {
    expect(s.weekStreak).toBeGreaterThanOrEqual(2);
  });

  it('is safe on empty/null input', () => {
    const z = overviewStats(null, TODAY);
    expect(z.gymDays).toBe(0);
    expect(z.totalVolume).toBe(0);
    expect(z.topExercise).toBeNull();
  });
});
