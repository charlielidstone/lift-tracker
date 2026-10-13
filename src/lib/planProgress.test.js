import { describe, it, expect } from 'vitest';
import {
  setBeatsPlan,
  exerciseProgress,
  planChecklist,
  planSummary,
  formatRepRange,
  lastSessionSetsFor,
} from './planProgress';

const pe = (over = {}) => ({
  exerciseId: 'x1',
  name: 'Machine chest press',
  targetSets: 3,
  repMin: 6,
  repMax: 8,
  rpe: 8,
  position: 0,
  ...over,
});

describe('setBeatsPlan', () => {
  it('beats when top reps hit at/under the RPE ceiling', () => {
    expect(setBeatsPlan({ reps: 8, rpe: 8 }, pe())).toBe(true);
    expect(setBeatsPlan({ reps: 9, rpe: 7 }, pe())).toBe(true);
  });

  it('does not beat when reps fall short of the top of the range', () => {
    expect(setBeatsPlan({ reps: 7, rpe: 7 }, pe())).toBe(false);
  });

  it('does not beat when RPE is above the ceiling (too hard to add weight)', () => {
    expect(setBeatsPlan({ reps: 8, rpe: 9 }, pe())).toBe(false);
  });

  it('is inconclusive (no beat) when RPE is missing', () => {
    expect(setBeatsPlan({ reps: 8, rpe: null }, pe())).toBe(false);
  });

  it('falls back to the default ceiling (8) when the plan has no target RPE', () => {
    expect(setBeatsPlan({ reps: 8, rpe: 8 }, pe({ rpe: null }))).toBe(true);
    expect(setBeatsPlan({ reps: 8, rpe: 9 }, pe({ rpe: null }))).toBe(false);
  });
});

describe('exerciseProgress', () => {
  it('counts done sets and remaining toward the target', () => {
    const p = exerciseProgress(pe(), [{ reps: 6, rpe: 9 }, { reps: 6, rpe: 9 }]);
    expect(p.doneSets).toBe(2);
    expect(p.remaining).toBe(1);
    expect(p.met).toBe(false);
  });

  it('marks met when target sets reached and clamps remaining at 0', () => {
    const p = exerciseProgress(pe(), [
      { reps: 6, rpe: 9 },
      { reps: 6, rpe: 9 },
      { reps: 6, rpe: 9 },
      { reps: 6, rpe: 9 },
    ]);
    expect(p.met).toBe(true);
    expect(p.remaining).toBe(0);
  });

  it('flags addWeight only when met AND every set beat the plan', () => {
    const allEasy = exerciseProgress(pe(), [
      { reps: 8, rpe: 7 },
      { reps: 8, rpe: 8 },
      { reps: 9, rpe: 8 },
    ]);
    expect(allEasy.addWeight).toBe(true);

    const oneHard = exerciseProgress(pe(), [
      { reps: 8, rpe: 7 },
      { reps: 8, rpe: 8 },
      { reps: 6, rpe: 10 },
    ]);
    expect(oneHard.addWeight).toBe(false);
  });

  it('does not flag addWeight before the target sets are met', () => {
    const p = exerciseProgress(pe(), [{ reps: 8, rpe: 7 }]);
    expect(p.addWeight).toBe(false);
  });

  it('carries the add-weight hint when nothing is logged today but the prior session beat the plan', () => {
    const prior = [
      { reps: 8, rpe: 7 },
      { reps: 8, rpe: 8 },
      { reps: 9, rpe: 8 },
    ];
    const p = exerciseProgress(pe(), [], prior);
    expect(p.carryAddWeight).toBe(true);
    expect(p.addWeight).toBe(false); // nothing logged today yet
  });

  it('does not carry when the prior session did not beat the plan', () => {
    const prior = [
      { reps: 8, rpe: 7 },
      { reps: 8, rpe: 8 },
      { reps: 6, rpe: 10 }, // one hard set kills it
    ];
    expect(exerciseProgress(pe(), [], prior).carryAddWeight).toBe(false);
  });

  it('does not carry when the prior session was incomplete (under target sets)', () => {
    const prior = [{ reps: 8, rpe: 7 }, { reps: 8, rpe: 7 }]; // only 2 of 3
    expect(exerciseProgress(pe(), [], prior).carryAddWeight).toBe(false);
  });

  it('clears the carried hint as soon as a set is logged today', () => {
    const prior = [
      { reps: 8, rpe: 7 },
      { reps: 8, rpe: 8 },
      { reps: 9, rpe: 8 },
    ];
    const p = exerciseProgress(pe(), [{ reps: 8, rpe: 9 }], prior);
    expect(p.carryAddWeight).toBe(false);
  });
});

describe('lastSessionSetsFor', () => {
  const history = [
    { type: 'Pull', exercises: [{ exerciseId: 'x1', sets: [{ reps: 8, rpe: 8 }] }] },
    { type: 'Push', exercises: [{ exerciseId: 'x1', sets: [{ reps: 6, rpe: 9 }] }] },
    { type: 'Pull', exercises: [{ exerciseId: 'x1', sets: [{ reps: 10, rpe: 7 }] }] },
  ];

  it('returns the newest matching-type session that logged the exercise', () => {
    const sets = lastSessionSetsFor(history, 'x1', 'Pull');
    expect(sets).toEqual([{ reps: 8, rpe: 8 }]); // the first Pull entry, not the Push one
  });

  it('skips sessions of other types', () => {
    expect(lastSessionSetsFor(history, 'x1', 'Legs')).toEqual([]);
  });

  it('skips sessions where the exercise had no sets', () => {
    const h = [
      { type: 'Pull', exercises: [{ exerciseId: 'x1', sets: [] }] },
      { type: 'Pull', exercises: [{ exerciseId: 'x1', sets: [{ reps: 8, rpe: 8 }] }] },
    ];
    expect(lastSessionSetsFor(h, 'x1', 'Pull')).toEqual([{ reps: 8, rpe: 8 }]);
  });

  it('returns [] for empty/missing history or exerciseId', () => {
    expect(lastSessionSetsFor([], 'x1', 'Pull')).toEqual([]);
    expect(lastSessionSetsFor(null, 'x1', 'Pull')).toEqual([]);
    expect(lastSessionSetsFor(history, null, 'Pull')).toEqual([]);
  });
});

describe('planChecklist', () => {
  const plan = {
    id: 'p1',
    type: 'Push',
    name: 'Default',
    exercises: [pe(), pe({ exerciseId: 'x2', name: 'Lateral raise', repMin: 12, repMax: 15 })],
  };

  it('matches logged sets to planned exercises by exerciseId', () => {
    const logged = [
      { exerciseId: 'x1', sets: [{ reps: 6, rpe: 9 }, { reps: 6, rpe: 9 }] },
      { exerciseId: 'x2', sets: [] },
    ];
    const cl = planChecklist(plan, logged);
    expect(cl).toHaveLength(2);
    expect(cl[0].doneSets).toBe(2);
    expect(cl[1].doneSets).toBe(0);
  });

  it('treats an unlogged planned exercise as zero done', () => {
    const cl = planChecklist(plan, []);
    expect(cl.every((c) => c.doneSets === 0)).toBe(true);
  });

  it('returns [] for a null plan', () => {
    expect(planChecklist(null, [])).toEqual([]);
  });

  it('threads history into the carried add-weight hint for the plan type', () => {
    const history = [
      {
        type: 'Push',
        exercises: [
          {
            exerciseId: 'x1',
            sets: [
              { reps: 8, rpe: 7 },
              { reps: 8, rpe: 8 },
              { reps: 8, rpe: 8 },
            ],
          },
        ],
      },
    ];
    const cl = planChecklist(plan, [], history);
    expect(cl[0].carryAddWeight).toBe(true); // x1 beat the plan last Push session
    expect(cl[1].carryAddWeight).toBe(false); // x2 never logged
  });
});

describe('planSummary', () => {
  it('counts met exercises and flags allDone', () => {
    const cl = [{ met: true }, { met: true }, { met: false }];
    expect(planSummary(cl)).toEqual({ complete: 2, total: 3, allDone: false });
    expect(planSummary([{ met: true }]).allDone).toBe(true);
    expect(planSummary([]).allDone).toBe(false);
  });
});

describe('formatRepRange', () => {
  it('shows a range, collapsing when min === max', () => {
    expect(formatRepRange(6, 8)).toBe('6–8');
    expect(formatRepRange(10, 10)).toBe('10');
  });
});
