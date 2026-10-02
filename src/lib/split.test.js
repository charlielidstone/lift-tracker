import { describe, expect, it } from 'vitest';
import {
  findDayByName,
  groupsForType,
  newDay,
  removeDay,
  upsertDay,
  validateDay,
} from '@/lib/split';

const split = [
  { id: 'd1', name: 'Push', muscleGroups: ['chest', 'shoulders', 'arms'] },
  { id: 'd2', name: 'Pull', muscleGroups: ['back', 'arms'] },
];

describe('findDayByName / groupsForType', () => {
  it('matches case-insensitively and trims', () => {
    expect(findDayByName(split, ' push ').id).toBe('d1');
    expect(groupsForType(split, 'PULL')).toEqual(['back', 'arms']);
  });
  it('returns null/[] when no match', () => {
    expect(findDayByName(split, 'Legs')).toBeNull();
    expect(groupsForType(split, null)).toEqual([]);
  });
});

describe('validateDay', () => {
  it('requires a name', () => {
    expect(validateDay(split, newDay('  '))).toBe('Name required');
  });
  it('rejects a duplicate name (different id)', () => {
    expect(validateDay(split, { id: 'new', name: 'push', muscleGroups: [] })).toMatch(/already/);
  });
  it('allows renaming the same day (same id)', () => {
    expect(validateDay(split, { id: 'd1', name: 'Push', muscleGroups: ['chest'] })).toBeNull();
  });
  it('allows a new unique name', () => {
    expect(validateDay(split, newDay('Legs', ['legs']))).toBeNull();
  });
});

describe('upsertDay / removeDay', () => {
  it('appends a new day', () => {
    const next = upsertDay(split, newDay('Legs', ['legs']));
    expect(next).toHaveLength(3);
  });
  it('replaces an existing day by id', () => {
    const next = upsertDay(split, { id: 'd1', name: 'Push', muscleGroups: ['chest'] });
    expect(next).toHaveLength(2);
    expect(next.find((d) => d.id === 'd1').muscleGroups).toEqual(['chest']);
  });
  it('removes by id', () => {
    expect(removeDay(split, 'd1').map((d) => d.id)).toEqual(['d2']);
  });
});
