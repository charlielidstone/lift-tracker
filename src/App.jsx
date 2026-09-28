import { useState } from 'react';
import './App.css';
import { WorkoutView } from './components/WorkoutView';
import { WorkoutHistory } from './components/WorkoutHistory';
import { Login } from './components/Login';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { PWAUpdater } from '@/components/PWAUpdater';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
];

// Whether login is REQUIRED to use the app. Off by default so the app keeps working
// while multi-user is being built; flip to 'true' in .env.local when ready to enforce.
const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true';

function MainApp() {
  const [tab, setTab] = useState('today');
  const { user, signOut } = useAuth();

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="mb-4 flex items-center gap-2">
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
        {user && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        )}
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

// Gate: when REQUIRE_AUTH is on, show Login until there's a session.
function Gate() {
  const { user, loading } = useAuth();

  if (REQUIRE_AUTH) {
    if (loading) {
      return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
    }
    if (!user) {
      return <Login />;
    }
  }
  return <MainApp />;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
      <PWAUpdater />
    </AuthProvider>
  );
}

export default App;
