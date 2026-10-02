import { describe, expect, it } from 'vitest';
import { defaultWeightFor, lastSetFor } from '@/lib/lastWeight';

// newest-first history
const history = [
  {
    date: '2026-10-01',
    exercises: [
      { exerciseId: 'bench', sets: [{ weight: 155, reps: 5 }, { weight: 165, reps: 3 }] },
    ],
  },
  {
    date: '2026-09-24',
    exercises: [
      { exerciseId: 'bench', sets: [{ weight: 145, reps: 8 }] },
      { exerciseId: 'squat', sets: [{ weight: 225, reps: 5 }] },
    ],
  },
];

describe('lastSetFor', () => {
  it('returns the first set of the most recent session with that exercise', () => {
    expect(lastSetFor(history, 'bench').weight).toBe(155);
  });
  it('skips sessions that lack the exercise', () => {
    expect(lastSetFor(history, 'squat').weight).toBe(225);
  });
  it('returns null when never logged', () => {
    expect(lastSetFor(history, 'deadlift')).toBeNull();
  });
  it('is safe on empty/null input', () => {
    expect(lastSetFor(null, 'bench')).toBeNull();
    expect(lastSetFor([], 'bench')).toBeNull();
    expect(lastSetFor(history, null)).toBeNull();
  });
});

describe('defaultWeightFor', () => {
  it('uses the last opening weight when available', () => {
    expect(defaultWeightFor(history, 'bench', 100)).toBe(155);
  });
  it('falls back when never logged', () => {
    expect(defaultWeightFor(history, 'deadlift', 100)).toBe(100);
  });
  it('falls back when the last weight is not finite', () => {
    const bad = [{ exercises: [{ exerciseId: 'x', sets: [{ weight: null, reps: 5 }] }] }];
    expect(defaultWeightFor(bad, 'x', 100)).toBe(100);
  });
});
