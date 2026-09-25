import './App.css';
import { WorkoutView } from './components/WorkoutView';

function App() {
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Today's Workout</h1>
      <WorkoutView />
    </div>
  );
}

export default App;
