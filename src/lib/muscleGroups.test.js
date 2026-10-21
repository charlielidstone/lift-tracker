import { describe, it, expect } from 'vitest';
import {
  muscleKey,
  groupLabel,
  muscleMeta,
  weeklySetsByMuscle,
  MUSCLE_GROUP_KEYS,
} from '@/lib/muscleGroups';

describe('muscleKey', () => {
  it('normalises canonical values case-insensitively', () => {
    expect(muscleKey('chest')).toBe('chest');
    expect(muscleKey('Chest')).toBe('chest');
    expect(muscleKey('  LEGS ')).toBe('legs');
  });
  it('maps unknown/custom values to other', () => {
    expect(muscleKey('forearms')).toBe('other');
    expect(muscleKey('calves')).toBe('other');
  });
  it('returns null for empty/missing', () => {
    expect(muscleKey(null)).toBeNull();
    expect(muscleKey(undefined)).toBeNull();
    expect(muscleKey('')).toBeNull();
    expect(muscleKey('   ')).toBeNull();
  });
});

describe('muscleMeta', () => {
  it('gives label + colour classes for a canonical group', () => {
    const m = muscleMeta('chest');
    expect(m.key).toBe('chest');
    expect(m.label).toBe('Chest');
    expect(m.badge).toContain('rose');
    expect(m.bar).toBe('bg-rose-500');
  });
  it('title-cases a custom value as the badge label on the neutral colour', () => {
    const m = muscleMeta('forearms');
    expect(m.key).toBe('other');
    expect(m.label).toBe('Forearms');
    expect(m.badge).toContain('slate');
  });
  it('returns null for no group', () => {
    expect(muscleMeta('')).toBeNull();
    expect(muscleMeta(null)).toBeNull();
  });
});

describe('groupLabel', () => {
  it('labels canonical keys and other', () => {
    expect(groupLabel('shoulders')).toBe('Shoulders');
    expect(groupLabel('other')).toBe('Other');
  });
  it('exposes the canonical keys', () => {
    expect(MUSCLE_GROUP_KEYS).toContain('chest');
    expect(MUSCLE_GROUP_KEYS).toHaveLength(6);
  });
});

describe('weeklySetsByMuscle', () => {
  const push = {
    type: 'Push',
    exercises: [
      { muscleGroup: 'chest', targetSets: 3 },
      { muscleGroup: 'chest', targetSets: 3 },
      { muscleGroup: 'shoulders', targetSets: 2 },
      { muscleGroup: 'arms', targetSets: 2 },
    ],
  };
  const pull = {
    type: 'Pull',
    exercises: [
      { muscleGroup: 'back', targetSets: 4 },
      { muscleGroup: 'arms', targetSets: 3 },
    ],
  };
  // getDay-indexed: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  const schedule = ['Push', 'Pull', 'Rest', 'Rest', 'Rest', 'Push', 'Rest'];

  it('sums target sets per primary group across the week', () => {
    const { groups, total, daysPlanned } = weeklySetsByMuscle(schedule, [push, pull]);
    expect(daysPlanned).toBe(3); // 2× Push + 1× Pull
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.sets]));
    // Push counted twice (Sun + Fri): chest 6×2=12, shoulders 2×2=4, arms 2×2=4
    // Pull once: back 4, arms +3
    expect(byKey.chest).toBe(12);
    expect(byKey.shoulders).toBe(4);
    expect(byKey.back).toBe(4);
    expect(byKey.arms).toBe(7);
    expect(total).toBe(27);
  });

  it('sorts groups by sets descending', () => {
    const { groups } = weeklySetsByMuscle(schedule, [push, pull]);
    expect(groups[0].key).toBe('chest');
    expect(groups.map((g) => g.sets)).toEqual([...groups.map((g) => g.sets)].sort((a, b) => b - a));
  });

  it('skips rest days and types with no plan', () => {
    const { total, daysPlanned } = weeklySetsByMuscle(
      ['Legs', 'Rest', 'Rest', 'Rest', 'Rest', 'Rest', 'Rest'],
      [push, pull], // no Legs plan
    );
    expect(total).toBe(0);
    expect(daysPlanned).toBe(0);
  });

  it('buckets unknown groups under other and ignores zero/blank sets', () => {
    const odd = {
      type: 'Push',
      exercises: [
        { muscleGroup: 'forearms', targetSets: 2 },
        { muscleGroup: 'chest', targetSets: 0 },
        { muscleGroup: null, targetSets: 3 },
      ],
    };
    const { groups } = weeklySetsByMuscle(
      ['Push', 'Rest', 'Rest', 'Rest', 'Rest', 'Rest', 'Rest'],
      [odd],
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.sets]));
    expect(byKey.other).toBe(5); // forearms 2 + null 3; the 0-set chest dropped
    expect(byKey.chest).toBeUndefined();
  });

  it('handles empty inputs', () => {
    expect(weeklySetsByMuscle([], [])).toEqual({ groups: [], total: 0, daysPlanned: 0 });
    expect(weeklySetsByMuscle(undefined, undefined)).toEqual({
      groups: [],
      total: 0,
      daysPlanned: 0,
    });
  });
});
