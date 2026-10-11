import { useState } from 'react';
import './App.css';
import { WorkoutView } from './components/WorkoutView';
import { WorkoutHistory } from './components/WorkoutHistory';
import { NotesView } from './components/NotesView';
import { LibraryView } from './components/LibraryView';
import { PlanView } from './components/PlanView';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { WorkoutProvider } from '@/hooks/WorkoutProvider';
import { SettingsProvider } from '@/hooks/SettingsProvider';
import { ScheduleProvider } from '@/hooks/ScheduleProvider';
import { PlansProvider } from '@/hooks/PlansProvider';
import { PWAUpdater } from '@/components/PWAUpdater';

// Whether login is REQUIRED to use the app. Off by default so the app keeps working
// while multi-user is being built; flip to 'true' in .env.local when ready to enforce.
const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true';

// ── Workout screen: Today + History sub-tabs ──
const WORKOUT_SUBTABS = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'notes', label: 'Notes' },
];

function WorkoutScreen() {
  const [sub, setSub] = useState('today');
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        {WORKOUT_SUBTABS.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant={sub === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSub(id)}
            aria-pressed={sub === id}
          >
            {label}
          </Button>
        ))}
      </div>
      {sub === 'today' && <WorkoutView />}
      {sub === 'history' && <WorkoutHistory />}
      {sub === 'notes' && <NotesView />}
    </>
  );
}

const TITLES = {
  library: 'Library',
  workout: 'Workout',
  plan: 'Plan',
  progress: 'Progress',
  settings: 'Settings',
};

function MainApp() {
  const [screen, setScreen] = useState('workout');

  return (
    <WorkoutProvider>
      <ScheduleProvider>
        <PlansProvider>
          {/* App shell: fills the webview (h-full, document height is locked in
              index.css). ONLY <main> scrolls; the bottom nav stays put. Top inset
              clears the status bar / Dynamic Island; the nav carries the bottom inset. */}
          <div
            className="flex h-full flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-md p-4">
                <h1 className="mb-4 text-xl font-semibold">{TITLES[screen]}</h1>
                {screen === 'workout' && <WorkoutScreen />}
                {screen === 'library' && <LibraryView />}
                {screen === 'plan' && <PlanView />}
                {screen === 'progress' && <ProgressView />}
                {screen === 'settings' && <SettingsView />}
              </div>
            </main>
            <BottomNav active={screen} onChange={setScreen} />
          </div>
        </PlansProvider>
      </ScheduleProvider>
    </WorkoutProvider>
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
      <SettingsProvider>
        <Gate />
        <PWAUpdater />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
