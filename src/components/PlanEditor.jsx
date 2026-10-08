// PlanEditor — the "Session plans" section of the Plan tab: edit the CONTENT of
// each workout type (which exercises, and per exercise target sets × rep-range +
// RPE). Order is NOT edited here — a plan is an unordered checklist at the gym.
//
// Shows a card per type that's either in the weekly schedule or already has a plan.
// State comes from PlansProvider; the exercise library from the shared WorkoutProvider.

import { useMemo, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { Stepper } from '@/components/Stepper';
import { ExercisePicker } from '@/components/ExercisePicker';
import { usePlans } from '@/hooks/PlansProvider';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';
import { useSchedule } from '@/hooks/ScheduleProvider';
import { BOUNDS, STEP, WORKOUT_TYPES } from '@/lib/defaults';
import { REST } from '@/lib/schedule';

const SETS_BOUNDS = { min: 1, max: 12 };

function PlanExerciseRow({ planId, exercise, onUpdate, onRemove }) {
  return (
    <li className="rounded-lg border border-border px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{exercise.name}</span>
        <button
          type="button"
          aria-label={`Remove ${exercise.name}`}
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Stepper
          label="sets"
          value={exercise.targetSets}
          step={1}
          min={SETS_BOUNDS.min}
          max={SETS_BOUNDS.max}
          onChange={(v) => onUpdate(planId, exercise.id, { targetSets: v })}
        />
        <Stepper
          label="min reps"
          value={exercise.repMin}
          step={STEP.reps}
          min={BOUNDS.reps.min}
          max={exercise.repMax}
          onChange={(v) => onUpdate(planId, exercise.id, { repMin: v })}
        />
        <Stepper
          label="max reps"
          value={exercise.repMax}
          step={STEP.reps}
          min={exercise.repMin}
          max={BOUNDS.reps.max}
          onChange={(v) => onUpdate(planId, exercise.id, { repMax: v })}
        />
        <Stepper
          label="RPE"
          value={exercise.rpe ?? BOUNDS.rpe.max}
          step={STEP.rpe}
          min={BOUNDS.rpe.min}
          max={BOUNDS.rpe.max}
          onChange={(v) => onUpdate(planId, exercise.id, { rpe: v })}
        />
      </div>
    </li>
  );
}

function PlanTypeCard({ type }) {
  const { getPlan, addExerciseToPlan, updatePlanExercise, removePlanExercise } = usePlans();
  const { library } = useWorkoutContext();
  const [open, setOpen] = useState(false);

  const plan = getPlan(type);
  const exercises = plan?.exercises ?? [];
  const inPlanIds = exercises.map((e) => e.exerciseId);

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-medium text-foreground">{type}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {exercises.length === 0
              ? 'no exercises'
              : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
          </span>
          <ChevronDown
            className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {exercises.length > 0 && (
            <ul className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <PlanExerciseRow
                  key={ex.id}
                  planId={plan.id}
                  exercise={ex}
                  onUpdate={updatePlanExercise}
                  onRemove={() => removePlanExercise(plan.id, ex.id)}
                />
              ))}
            </ul>
          )}
          <ExercisePicker
            library={library}
            inWorkoutIds={inPlanIds}
            onPick={(libEx) => addExerciseToPlan(type, libEx)}
          />
          {exercises.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add the exercises you want in a {type} session — order doesn&apos;t matter, you&apos;ll
              do them in whatever order a machine is free.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function PlanEditor() {
  const { schedule } = useSchedule();
  const { plans } = usePlans();

  // Types to show: those in the weekly schedule ∪ those that already have a plan.
  // If neither (fresh user), fall back to all types so there's somewhere to start.
  const types = useMemo(() => {
    const set = new Set();
    for (const t of schedule) if (t && t !== REST) set.add(t);
    for (const p of plans) set.add(p.type);
    const list = [...set];
    if (list.length === 0) return WORKOUT_TYPES;
    // Stable order following WORKOUT_TYPES.
    return WORKOUT_TYPES.filter((t) => list.includes(t));
  }, [schedule, plans]);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">Session plans</h2>
      <p className="text-xs text-muted-foreground">
        Set the exercises and target sets × reps for each session type. On Today these show as a
        checklist you can tick off in any order.
      </p>
      <ul className="flex flex-col gap-2">
        {types.map((t) => (
          <PlanTypeCard key={t} type={t} />
        ))}
      </ul>
    </div>
  );
}
