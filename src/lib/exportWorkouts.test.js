import { describe, expect, it } from 'vitest';
import {
  exportFilename,
  filterByRange,
  workoutsToJson,
  workoutsToText,
} from '@/lib/exportWorkouts';

const data = [
  {
    date: '2026-09-14',
    type: 'Push',
    exercises: [{ name: 'Bench Press', sets: [{ weight: 135, reps: 8, rpe: 8 }] }],
  },
  {
    date: '2026-09-20',
    type: 'Pull',
    exercises: [{ name: 'Lat Pulldown', sets: [{ weight: 120, reps: 12, rpe: null }] }],
  },
  { date: '2026-09-25', type: null, exercises: [] }, // empty day — should be skipped
];

describe('filterByRange', () => {
  it('filters inclusive on both bounds', () => {
    expect(filterByRange(data, '2026-09-14', '2026-09-20').map((w) => w.date)).toEqual([
      '2026-09-14',
      '2026-09-20',
    ]);
  });
  it('open-ended bounds', () => {
    expect(filterByRange(data, '2026-09-20', null).map((w) => w.date)).toEqual([
      '2026-09-20',
      '2026-09-25',
    ]);
    expect(filterByRange(data, null, '2026-09-14').map((w) => w.date)).toEqual(['2026-09-14']);
  });
  it('handles empty/null input', () => {
    expect(filterByRange(null, null, null)).toEqual([]);
  });
});

describe('workoutsToText', () => {
  it('renders readable text and skips empty days', () => {
    const txt = workoutsToText(data, { unit: 'lb' });
    expect(txt).toContain('Bench Press');
    expect(txt).toContain('- 135 lb × 8 @ RPE 8');
    expect(txt).toContain('- 120 lb × 12'); // no RPE suffix when null
    expect(txt).not.toContain('@ RPE null');
    expect(txt).toContain('workouts: 2'); // empty day excluded
  });
  it('converts weights to kg when unit is kg', () => {
    const txt = workoutsToText(data, { unit: 'kg' });
    expect(txt).toContain('kg');
    expect(txt).not.toContain('135 lb');
  });
});

describe('workoutsToJson', () => {
  it('keeps canonical lb + meta, skips empty days', () => {
    const obj = JSON.parse(workoutsToJson(data, { from: '2026-09-14', to: '2026-09-25' }));
    expect(obj.unit).toBe('lb');
    expect(obj.range).toEqual({ from: '2026-09-14', to: '2026-09-25' });
    expect(obj.workouts).toHaveLength(2);
    expect(obj.workouts[0].exercises[0].sets[0].weight).toBe(135);
  });
});

describe('exportFilename', () => {
  it('builds a dated filename', () => {
    expect(exportFilename('txt', '2026-09-01', '2026-10-02')).toBe(
      'lift-tracker-2026-09-01_2026-10-02.txt',
    );
    expect(exportFilename('json', null, null)).toBe('lift-tracker-all.json');
  });
});
