// BottomNav — floating bottom navigation for the top-level screens.
// Fixed to the bottom, safe-area aware (iOS notch), with icon + label per item.
// The WORKOUT tab is the primary action: rendered as a raised, filled accent
// circle (FAB-style) so it stands out from the other tabs.

import { CalendarDays, Dumbbell, Library, LineChart, Settings } from 'lucide-react';
import { cn } from 'cn';

const ITEMS = [
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'workout', label: 'Workout', Icon: Dumbbell, primary: true },
  { id: 'progress', label: 'Progress', Icon: LineChart },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ active, onChange }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map(({ id, label, Icon, primary }) => {
          const isActive = active === id;

          // Primary (Workout): raised filled accent circle that always stands out.
          if (primary) {
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 pt-3 text-xs"
              >
                <span
                  className={cn(
                    'flex size-12 -translate-y-3 items-center justify-center rounded-full',
                    'bg-accent text-accent-foreground shadow-lg ring-4 ring-background transition',
                    isActive && 'shadow-accent/40',
                  )}
                >
                  <Icon className="size-6 stroke-[2.5]" />
                </span>
                <span
                  className={cn('-mt-1 text-foreground', isActive ? 'font-semibold' : 'font-medium')}
                >
                  {label}
                </span>
              </button>
            );
          }

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
