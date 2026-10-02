// BottomNav — floating bottom navigation for the three top-level screens.
// Fixed to the bottom, safe-area aware (iOS notch), with icon + label per item.

import { Dumbbell, Library, Settings } from 'lucide-react';
import { cn } from 'cn';

const ITEMS = [
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'workout', label: 'Workout', Icon: Dumbbell },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ active, onChange }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
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
