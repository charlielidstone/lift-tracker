import { describe, it, expect } from 'vitest';
import {
  ageFactor,
  liftIdForName,
  thresholdsFor,
  rateLift,
  bestE1rmByLift,
  LEVELS,
} from './strengthStandards.js';

describe('ageFactor', () => {
  it('is 1 in prime years and for invalid input', () => {
    expect(ageFactor(25)).toBe(1);
    expect(ageFactor(40)).toBe(1);
    expect(ageFactor(undefined)).toBe(1);
    expect(ageFactor(NaN)).toBe(1);
  });

  it('eases standards past 40 (factor < 1, decreasing with age)', () => {
    expect(ageFactor(50)).toBeCloseTo(1 / 1.13, 4);
    expect(ageFactor(60)).toBeLessThan(ageFactor(50));
  });

  it('clamps above 80', () => {
    expect(ageFactor(95)).toBeCloseTo(1 / 2.05, 4);
  });
});

describe('liftIdForName', () => {
  it('matches canonical and variant names, case-insensitively', () => {
    expect(liftIdForName('Squat')).toBe('squat');
    expect(liftIdForName('Back Squat')).toBe('squat');
    expect(liftIdForName('bench press')).toBe('bench');
    expect(liftIdForName('Deadlift')).toBe('deadlift');
    expect(liftIdForName('Overhead Press')).toBe('ohp');
  });

  it('returns null for non-standard / empty names', () => {
    expect(liftIdForName('Leg Press')).toBeNull();
    expect(liftIdForName('Incline Bench Press')).toBeNull();
    expect(liftIdForName('')).toBeNull();
    expect(liftIdForName(null)).toBeNull();
  });
});

describe('thresholdsFor', () => {
  const profile = { sex: 'male', bodyweightLb: 200, age: 30 };

  it('computes bodyweight-multiple thresholds for each level', () => {
    const t = thresholdsFor('bench', profile);
    // male bench multiples [0.5, 0.75, 1.0, 1.5, 2.0] × 200
    expect(t.Beginner).toBeCloseTo(100, 5);
    expect(t.Intermediate).toBeCloseTo(200, 5);
    expect(t.Elite).toBeCloseTo(400, 5);
  });

  it('uses female multiples when sex is female', () => {
    const t = thresholdsFor('squat', { ...profile, sex: 'female' });
    // female squat [0.5, 0.75, 1.25, 1.5, 2.0] × 200
    expect(t.Beginner).toBeCloseTo(100, 5);
    expect(t.Elite).toBeCloseTo(400, 5);
  });

  it('scales down for masters age', () => {
    const young = thresholdsFor('deadlift', profile);
    const old = thresholdsFor('deadlift', { ...profile, age: 60 });
    expect(old.Intermediate).toBeLessThan(young.Intermediate);
  });

  it('returns null for unusable profile', () => {
    expect(thresholdsFor('bench', { sex: 'male', bodyweightLb: 0, age: 30 })).toBeNull();
    expect(thresholdsFor('bench', { sex: 'male', age: 30 })).toBeNull();
    expect(thresholdsFor('notalift', profile)).toBeNull();
  });
});

describe('rateLift', () => {
  // bench @ bw200 male: [100,150,200,300,400]
  const t = thresholdsFor('bench', { sex: 'male', bodyweightLb: 200, age: 30 });

  it('picks the highest level reached', () => {
    expect(rateLift(100, t).level).toBe('Beginner');
    expect(rateLift(250, t).level).toBe('Intermediate'); // ≥200, <300
    expect(rateLift(400, t).level).toBe('Elite');
  });

  it('reports below-Beginner as null level', () => {
    expect(rateLift(50, t).level).toBeNull();
  });

  it('computes lb to the next level', () => {
    const r = rateLift(250, t);
    expect(r.nextLevel).toBe('Advanced');
    expect(r.toNext).toBeCloseTo(50, 5); // 300 - 250
  });

  it('has no next level at Elite', () => {
    const r = rateLift(500, t);
    expect(r.nextLevel).toBeNull();
    expect(r.toNext).toBe(0);
  });

  it('positions levels at even anchors and clamps to [0,1]', () => {
    expect(rateLift(100, t).position).toBeCloseTo(0, 5); // Beginner → 0
    expect(rateLift(200, t).position).toBeCloseTo(0.5, 5); // Intermediate → 0.5
    expect(rateLift(400, t).position).toBeCloseTo(1, 5); // Elite → 1
    expect(rateLift(1000, t).position).toBe(1); // above Elite clamps
    expect(rateLift(0, t).position).toBe(0);
  });

  it('interpolates within a segment', () => {
    // halfway between Intermediate(200)=0.5 and Advanced(300)=0.75 → 0.625
    expect(rateLift(250, t).position).toBeCloseTo(0.625, 5);
  });

  it('returns null without thresholds', () => {
    expect(rateLift(200, null)).toBeNull();
  });
});

describe('bestE1rmByLift', () => {
  const history = [
    {
      date: '2026-02-01',
      exercises: [
        { name: 'Bench Press', sets: [{ weight: 185, reps: 5 }] },
        { name: 'Incline Bench Press', sets: [{ weight: 500, reps: 1 }] }, // not a standard lift
      ],
    },
    {
      date: '2026-02-03',
      exercises: [{ name: 'Bench Press', sets: [{ weight: 225, reps: 1 }] }],
    },
    {
      date: '2026-02-05',
      exercises: [{ name: 'Back Squat', sets: [{ weight: 315, reps: 3 }] }],
    },
  ];

  it('keeps the best est-1RM per lift and ignores non-standard names', () => {
    const best = bestE1rmByLift(history);
    expect(best.bench.e1rm).toBe(225); // 225×1 beats 185×5 (≈215.8)
    expect(best.squat.e1rm).toBeCloseTo(315 * (1 + 3 / 30), 5);
    expect(best.deadlift).toBeUndefined();
    expect(best.ohp).toBeUndefined();
  });

  it('handles empty/garbage input', () => {
    expect(bestE1rmByLift([])).toEqual({});
    expect(bestE1rmByLift(null)).toEqual({});
  });
});

describe('LEVELS', () => {
  it('is the five-band ladder', () => {
    expect(LEVELS).toEqual(['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']);
  });
});
