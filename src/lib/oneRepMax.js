/**
 * Estimated one-rep max (Epley formula).
 *
 * 1RM ≈ weight * (1 + reps / 30)
 *
 * Puts every set on one comparable scale regardless of rep count, so progress
 * shows even when reps change day to day. Valid roughly 1–10 reps; drifts high
 * beyond that. See docs/DECISIONS.md #4.
 *
 * @param {number} weight - Weight lifted, in the canonical unit (lb).
 * @param {number} reps - Reps completed (>= 1).
 * @returns {number} Estimated 1RM in the same unit as `weight`.
 */
export function estimateOneRepMax(weight, reps) {
  if (reps < 1) {
    throw new Error('reps must be at least 1');
  }
  // A single rep IS the 1RM — no estimation needed.
  if (reps === 1) {
    return weight;
  }
  return weight * (1 + reps / 30);
}
