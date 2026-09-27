import { useState } from 'react';
import './App.css';
import { WorkoutView } from './components/WorkoutView';
import { WorkoutHistory } from './components/WorkoutHistory';
import { Button } from '@/components/ui/button';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
];

function App() {
  const [tab, setTab] = useState('today');

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="mb-4 flex gap-2">
        {TABS.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'today' ? (
        <>
          <h1 className="text-xl font-semibold mb-4">Today's Workout</h1>
          <WorkoutView />
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold mb-4">History</h1>
          <WorkoutHistory />
        </>
      )}
    </div>
  );
}

export default App;
