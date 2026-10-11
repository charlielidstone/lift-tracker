// BottomNav — bottom navigation for the top-level screens. Lives as the last
// child of the app shell (NOT position:fixed) so it stays put while only the
// content area scrolls; safe-area aware (iOS home bar), icon + label per item.

import { CalendarDays, Dumbbell, Library, LineChart, Settings } from 'lucide-react';
import { cn } from 'cn';

const ITEMS = [
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'workout', label: 'Workout', Icon: Dumbbell },
  { id: 'progress', label: 'Progress', Icon: LineChart },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ active, onChange }) {
  return (
    <nav
      className="shrink-0 border-t border-border bg-background"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 pt-3 text-xs',
                isActive ? 'text-accent-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('size-5', isActive && 'stroke-[2.5]')} />
              <span className={cn(isActive && 'font-medium')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
