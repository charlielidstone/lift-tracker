/**
 * Clamp a number to an optional [min, max] range.
 * If a bound is undefined it's skipped (no clamping on that side).
 *
 * @param {number} value
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max ?? value, Math.max(min ?? value, value));
}
