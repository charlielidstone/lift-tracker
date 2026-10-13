// SyncStatusBadge — a subtle corner indicator for offline / syncing state.
// Replaces the old full-width amber banner: a small icon badge in the top-right
// that you can TAP to reveal the full "don't clear app data" warning (kept so the
// data-safety note the banner existed for is still reachable, just unobtrusive).

import { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { cn } from 'cn';

export function SyncStatusBadge({ online, pendingSync }) {
  const [open, setOpen] = useState(false);
  const show = !online || pendingSync;
  if (!show) return null;

  const offline = !online;
  const Icon = offline ? WifiOff : RefreshCw;
  const detail = offline
    ? "Offline — changes are saved on this device only and will sync when you're back online. Don't clear app data or reinstall until this clears."
    : 'Syncing unsaved changes… don’t clear app data until this finishes.';

  return (
    <div className="fixed right-3 top-3 z-50 flex max-w-[70%] flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={offline ? 'Offline — unsynced changes (tap for details)' : 'Syncing changes'}
        title={detail}
        className="flex size-8 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-600 shadow-sm backdrop-blur"
      >
        <Icon className={cn('size-4', !offline && 'animate-spin')} />
      </button>
      {open && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 shadow-sm backdrop-blur">
          {detail}
        </p>
      )}
    </div>
  );
}
