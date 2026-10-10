// PlanEditor — the "Session plans" section of the Plan tab: edit the CONTENT of
// each workout type (which exercises, and per exercise target sets × rep-range +
// RPE). Order is NOT edited here — a plan is an unordered checklist at the gym.
//
// Each plan card has a view mode (read-only chips) and an Edit mode (tap the
// Edit button). In Edit mode the stats become tap-to-expand +/- Steppers — the
// SAME EditableStat control the workout view (SetRow) uses — and the exercise
// picker + per-row remove buttons appear. Save just returns to view mode;
// persistence is automatic via PlansProvider's durable outbox.
//
// State comes from PlansProvider; the exercise library from the shared WorkoutProvider.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { EditableStat } from '@/components/EditableStat';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Button } from '@/components/ui/button';
import { usePlans } from '@/hooks/PlansProvider';
import { useWorkoutContext } from '@/hooks/WorkoutProvider';
import { useSchedule } from '@/hooks/ScheduleProvider';
import { BOUNDS, STEP, WORKOUT_TYPES } from '@/lib/defaults';
import { REST } from '@/lib/schedule';

const SETS_BOUNDS = { min: 1, max: 12 };

function PlanExerciseRow({ planId, exercise, onUpdate, onRemove, readOnly }) {
  // Which stat is expanded into a Stepper (only one at a time). null = all collapsed.
  const [activeField, setActiveField] = useState(null);
  const rowRef = useRef(null);

  const toggleField = (field) => setActiveField((cur) => (cur === field ? null : field));

  // Collapse when the user taps anywhere outside this row (mirrors SetRow).
  useEffect(() => {
    if (!activeField) return;
    const onPointerDown = (e) => {
      if (!rowRef.current?.contains(e.target)) setActiveField(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [activeField]);

  return (
    <li ref={rowRef} className="rounded-lg border border-border px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{exercise.name}</span>
        {!readOnly && (
          <button
            type="button"
            aria-label={`Remove ${exercise.name}`}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <EditableStat
          label="sets"
          value={exercise.targetSets}
          step={1}
          min={SETS_BOUNDS.min}
          max={SETS_BOUNDS.max}
          active={activeField === 'sets'}
          onActivate={() => toggleField('sets')}
          onChange={(v) => onUpdate(planId, exercise.id, { targetSets: v })}
          readOnly={readOnly}
        />
        {readOnly ? (
          // Saved view: collapse the two rep steppers into one range chip
          // (e.g. "12–15 reps", or just "12 reps" when min === max).
          <div className="relative shrink-0">
            <div className="flex items-center gap-1 bg-muted px-3 py-2 rounded-2xl">
              <span className="text-foreground tabular-nums font-medium">
                {exercise.repMin === exercise.repMax
                  ? exercise.repMin
                  : `${exercise.repMin}–${exercise.repMax}`}
              </span>
              <span className="text-muted-foreground text-sm">reps</span>
            </div>
          </div>
        ) : (
          <>
            <EditableStat
              label="min reps"
              value={exercise.repMin}
              step={STEP.reps}
              min={BOUNDS.reps.min}
              max={exercise.repMax}
              active={activeField === 'repMin'}
              onActivate={() => toggleField('repMin')}
              onChange={(v) => onUpdate(planId, exercise.id, { repMin: v })}
            />
            <EditableStat
              label="max reps"
              value={exercise.repMax}
              step={STEP.reps}
              min={exercise.repMin}
              max={BOUNDS.reps.max}
              active={activeField === 'repMax'}
              onActivate={() => toggleField('repMax')}
              onChange={(v) => onUpdate(planId, exercise.id, { repMax: v })}
            />
          </>
        )}
        <EditableStat
          label="RPE"
          value={exercise.rpe ?? BOUNDS.rpe.max}
          step={STEP.rpe}
          min={BOUNDS.rpe.min}
          max={BOUNDS.rpe.max}
          active={activeField === 'rpe'}
          onActivate={() => toggleField('rpe')}
          onChange={(v) => onUpdate(planId, exercise.id, { rpe: v })}
          readOnly={readOnly}
        />
      </div>
    </li>
  );
}

function PlanTypeCard({ type }) {
  const { getPlan, addExerciseToPlan, updatePlanExercise, removePlanExercise } = usePlans();
  const { library } = useWorkoutContext();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const plan = getPlan(type);
  const exercises = plan?.exercises ?? [];
  const inPlanIds = exercises.map((e) => e.exerciseId);

  // Collapsing the card always drops back to view mode.
  const toggleOpen = () => {
    setOpen((o) => !o);
    setEditing(false);
  };

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
        onClick={toggleOpen}
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant={editing ? 'default' : 'outline'}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? (
                <>
                  <Check className="size-4" /> Save
                </>
              ) : (
                <>
                  <Pencil className="size-4" /> Edit
                </>
              )}
            </Button>
          </div>

          {exercises.length > 0 && (
            <ul className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <PlanExerciseRow
                  key={ex.id}
                  planId={plan.id}
                  exercise={ex}
                  onUpdate={updatePlanExercise}
                  onRemove={() => removePlanExercise(plan.id, ex.id)}
                  readOnly={!editing}
                />
              ))}
            </ul>
          )}

          {editing && (
            <ExercisePicker
              library={library}
              inWorkoutIds={inPlanIds}
              onPick={(libEx) => addExerciseToPlan(type, libEx)}
            />
          )}

          {exercises.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {editing
                ? `Add the exercises you want in a ${type} session — order doesn't matter, you'll do them in whatever order a machine is free.`
                : 'No exercises yet — tap Edit to build this plan.'}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function PlanEditor() {
  const { schedule } = useSchedule();
  const { plans, online, pendingSync } = usePlans();

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
      {(!online || pendingSync) && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
          {!online
            ? '📴 Offline — plan changes are saved on this device and will sync when you reconnect. Don’t clear app data until this clears.'
            : 'Syncing plan changes… don’t clear app data until this finishes.'}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {types.map((t) => (
          <PlanTypeCard key={t} type={t} />
        ))}
      </ul>
    </div>
  );
}
