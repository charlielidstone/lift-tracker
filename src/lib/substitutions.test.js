import { describe, it, expect } from 'vitest';
import {
  SUBSTITUTION_GROUPS,
  normalizeExerciseName,
  substitutesFor,
} from './substitutions';

describe('normalizeExerciseName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeExerciseName('  Flat  Dumbbell   Press ')).toBe('flat dumbbell press');
    expect(normalizeExerciseName('Bench Press')).toBe('bench press');
  });

  it('handles nullish input', () => {
    expect(normalizeExerciseName(null)).toBe('');
    expect(normalizeExerciseName(undefined)).toBe('');
  });
});

describe('substitutesFor', () => {
  it('returns the whole group (normalized) for a grouped exercise', () => {
    const group = substitutesFor('Bench Press');
    expect(group.has('bench press')).toBe(true);
    expect(group.has('flat dumbbell press')).toBe(true);
    expect(group.has('machine chest press')).toBe(true);
  });

  it('is symmetric and case/space-insensitive', () => {
    expect(substitutesFor('flat dumbbell press').has('bench press')).toBe(true);
    expect(substitutesFor('  MACHINE   chest press ').has('bench press')).toBe(true);
  });

  it('keeps flat and incline presses in SEPARATE groups', () => {
    expect(substitutesFor('Bench Press').has('incline bench press')).toBe(false);
    expect(substitutesFor('Incline Bench Press').has('bench press')).toBe(false);
  });

  it('does not group a fly with a press', () => {
    expect(substitutesFor('Pec deck').has('bench press')).toBe(false);
  });

  it('returns just the exercise itself when it is in no group', () => {
    const solo = substitutesFor('Pec deck');
    expect([...solo]).toEqual(['pec deck']);
  });

  it('always includes the queried exercise in its own group', () => {
    for (const group of SUBSTITUTION_GROUPS) {
      for (const name of group) {
        expect(substitutesFor(name).has(normalizeExerciseName(name))).toBe(true);
      }
    }
  });

  it('assigns each name to at most one group', () => {
    const seen = new Map();
    SUBSTITUTION_GROUPS.forEach((group, i) => {
      for (const name of group) {
        const key = normalizeExerciseName(name);
        expect(seen.has(key)).toBe(false); // no name in two groups
        seen.set(key, i);
      }
    });
  });
});
