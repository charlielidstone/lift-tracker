// WorkoutProvider — shares one useWorkout() instance across the app so BOTH the
// Workout screen and the Library screen add exercises to the same today's workout.
// Without this, each screen calling useWorkout() would get its own isolated state.

import { createContext, useContext } from 'react';
import { useWorkout } from '@/hooks/useWorkout';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const workout = useWorkout();
  return <WorkoutContext.Provider value={workout}>{children}</WorkoutContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkoutContext() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkoutContext must be used within <WorkoutProvider>');
  return ctx;
}
