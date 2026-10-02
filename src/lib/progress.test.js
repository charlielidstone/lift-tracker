import { describe, expect, it } from 'vitest';
import {
  exerciseProgress,
  metricTrend,
  trackedExercises,
} from '@/lib/progress';

// newest-first, like fetchWorkoutHistory
const history = [
  {
    date: '2026-10-01',
    exercises: [
      { exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 155, reps: 5 }, { weight: 165, reps: 3 }] },
      { exerciseId: 'squat', name: 'Squat', sets: [{ weight: 225, reps: 5 }] },
    ],
  },
  {
    date: '2026-09-24',
    exercises: [
      { exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 135, reps: 8 }] },
    ],
  },
  {
    date: '2026-09-17',
    exercises: [
      // a placeholder/incomplete set — should be ignored
      { exerciseId: 'bench', name: 'Bench Press', sets: [{ weight: 0, reps: 0 }] },
    ],
  },
];

describe('exerciseProgress', () => {
  it('returns one point per valid session, oldest first', () => {
    const s = exerciseProgress(history, 'bench');
    expect(s.map((p) => p.date)).toEqual(['2026-09-24', '2026-10-01']); // Sep 17 dropped (no valid sets)
  });
  it('computes top set, volume, and e1rm from the best set', () => {
    const s = exerciseProgress(history, 'bench');
    const latest = s[s.length - 1]; // 2026-10-01: 155x5, 165x3
    expect(latest.topWeight).toBe(165);
    expect(latest.volume).toBe(155 * 5 + 165 * 3);
    // Epley best: 155*(1+5/30)=180.83 vs 165*(1+3/30)=181.5 → 181.5
    expect(latest.e1rm).toBeCloseTo(181.5, 1);
  });
  it('is safe on empty/null input', () => {
    expect(exerciseProgress(null, 'bench')).toEqual([]);
    expect(exerciseProgress(history, null)).toEqual([]);
    expect(exerciseProgress(history, 'nope')).toEqual([]);
  });
});

describe('trackedExercises', () => {
  it('lists each exercise with session count + last date, most recent first', () => {
    const list = trackedExercises(history);
    expect(list.map((e) => e.exerciseId)).toEqual(['bench', 'squat']);
    const bench = list.find((e) => e.exerciseId === 'bench');
    expect(bench.sessions).toBe(2); // Sep 17 had no valid sets
    expect(bench.lastDate).toBe('2026-10-01');
  });
});

describe('metricTrend', () => {
  it('reports first/last/delta/pct for a metric', () => {
    const s = exerciseProgress(history, 'bench');
    const t = metricTrend(s, 'topWeight'); // 135 → 165
    expect(t.first).toBe(135);
    expect(t.last).toBe(165);
    expect(t.delta).toBe(30);
    expect(t.pct).toBeCloseTo((30 / 135) * 100, 1);
  });
  it('returns null with fewer than 2 points', () => {
    expect(metricTrend(exerciseProgress(history, 'squat'), 'topWeight')).toBeNull();
  });
});
