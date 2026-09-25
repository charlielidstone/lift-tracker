// WorkoutView — the top of the logging UI: today's workout as a list of exercises.
// Renders an ExerciseCard per exercise, tracks which card is expanded, and has "add exercise".
//
// Workout state shape (local/in-memory for now; Supabase later):
//   { id, date, exercises: [ { id, exerciseId, name, sets: [...] }, ... ] }
//
// TODO (Charlie):
//   - useState for the workout (or just the exercises array) + which exercise id is expanded
//   - map exercises → <ExerciseCard>, passing expanded/onToggle/onChange/onRemove
//   - "add exercise": for v1 you can start with a hardcoded name or a simple prompt; the real
//     ExercisePicker (from the seeded library) comes later. On add, create an exercise entry
//     with ONE set pre-filled from DEFAULT_SET (design philosophy: zero-tap logged set).
//   - keep ALL math out of here — est. 1RM etc. lives in src/lib and gets called where displayed
//
// This is the component App renders. Wire it into App.jsx when you're ready.

import { useState } from 'react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { DEFAULT_SET } from '@/lib/defaults';

// TEMPORARY seed list — placeholder until the real ExercisePicker + seeded library (DECISIONS #1).
const EXERCISE_LIBRARY = [
  { exerciseId: 'bench', name: 'Bench Press' },
  { exerciseId: 'squat', name: 'Back Squat' },
  { exerciseId: 'deadlift', name: 'Deadlift' },
  { exerciseId: 'ohp', name: 'Overhead Press' },
  { exerciseId: 'row', name: 'Barbell Row' },
  { exerciseId: 'pullup', name: 'Pull-up' },
  { exerciseId: 'curl', name: 'Bicep Curl' },
];

const newSet = () => ({ id: crypto.randomUUID(), ...DEFAULT_SET });

export function WorkoutView() {
  const [exercises, setExercises] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const addExercise = (exerciseId) => {
    const lib = EXERCISE_LIBRARY.find((e) => e.exerciseId === exerciseId);
    if (!lib) return;
    const entry = {
      id: crypto.randomUUID(),
      exerciseId: lib.exerciseId,
      name: lib.name,
      sets: [newSet()], // pre-seed one set → zero-tap logged set (design philosophy)
    };
    setExercises((prev) => [...prev, entry]);
    setExpandedId(entry.id); // auto-expand the one you just added
  };

  const updateExercise = (id, nextExercise) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? nextExercise : e)));
  };

  const removeExercise = (id) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  };

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="flex flex-col gap-3">
      {exercises.length === 0 && (
        <p className="text-sm text-muted-foreground">No exercises yet — add one to start.</p>
      )}

      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          expanded={expandedId === exercise.id}
          onToggle={() => toggle(exercise.id)}
          onChange={(next) => updateExercise(exercise.id, next)}
          onRemove={() => removeExercise(exercise.id)}
        />
      ))}

      {/* TEMPORARY add-exercise control — replace with ExercisePicker later */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Add exercise"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value) addExercise(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Add exercise…
          </option>
          {EXERCISE_LIBRARY.map((e) => (
            <option key={e.exerciseId} value={e.exerciseId}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
