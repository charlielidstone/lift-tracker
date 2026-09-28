// PWAUpdater — registers the service worker and shows a tiny toast when a new
// version is available (autoUpdate installs it; this just prompts a reload) or
// when the app is ready to work offline.
//
// Uses the virtual module from vite-plugin-pwa. In dev it's active too
// (devOptions.enabled) so offline behavior is testable locally.

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function PWAUpdater() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
      <span className="flex-1 text-sm">
        {needRefresh ? 'A new version is available.' : 'App ready to work offline. ⚡'}
      </span>
      {needRefresh && (
        <Button type="button" size="sm" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={close}>
        Dismiss
      </Button>
    </div>
  );
}
