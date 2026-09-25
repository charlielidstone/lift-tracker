import { describe, it, expect } from 'vitest';
import { estimateOneRepMax } from './oneRepMax.js';

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('applies the Epley formula for multiple reps', () => {
    // 100 * (1 + 8/30) = 126.666...
    expect(estimateOneRepMax(100, 8)).toBeCloseTo(126.67, 1);
  });

  it('ranks a heavier-for-fewer set above a lighter-for-more set correctly', () => {
    const heavy = estimateOneRepMax(110, 5); // 128.33
    const light = estimateOneRepMax(100, 8); // 126.67
    expect(heavy).toBeGreaterThan(light);
  });

  it('throws when reps is below 1', () => {
    expect(() => estimateOneRepMax(100, 0)).toThrow();
  });
});
