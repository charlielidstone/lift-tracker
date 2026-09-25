import { describe, it, expect } from 'vitest';
import { clamp } from './clamp.js';

describe('clamp', () => {
  it('returns the value unchanged when within range', () => {
    expect(clamp(100, 0, 200)).toBe(100);
  });

  it('clamps up to min when below', () => {
    expect(clamp(-5, 0, 200)).toBe(0);
  });

  it('clamps down to max when above', () => {
    expect(clamp(250, 0, 200)).toBe(200);
  });

  it('skips the lower bound when min is undefined', () => {
    expect(clamp(-999, undefined, 200)).toBe(-999);
  });

  it('skips the upper bound when max is undefined', () => {
    expect(clamp(999, 0, undefined)).toBe(999);
  });

  it('is unbounded when both bounds are undefined', () => {
    expect(clamp(42)).toBe(42);
  });

  it('respects a value sitting exactly on a bound', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
