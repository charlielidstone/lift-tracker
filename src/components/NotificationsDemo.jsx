// NotificationsDemo — a minimal, honest demo of lock-screen notifications.
// Enable permission, then fire a LOCAL test notification via the service
// worker. No push backend yet: this proves the device can show a notification;
// server-sent reminders (while the app is closed) come later.

import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  notificationsSupported,
  getPermission,
  requestPermission,
  sendTestNotification,
  notifyUiState,
} from '@/lib/notifications';

export function NotificationsDemo() {
  const [permission, setPermission] = useState(() => getPermission());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const ui = notifyUiState({ supported: notificationsSupported(), permission });

  const enable = async () => {
    setError(null);
    try {
      const next = await requestPermission();
      setPermission(next);
    } catch {
      setError('Could not request permission.');
    }
  };

  const sendTest = async () => {
    setError(null);
    setSent(false);
    try {
      await sendTestNotification();
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch {
      setError('Could not show the notification. Install the app to your Home Screen first.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{ui.label}</p>

      <div className="flex flex-wrap gap-2">
        {ui.canEnable && (
          <Button type="button" size="sm" onClick={enable}>
            <Bell className="size-3.5" /> Enable notifications
          </Button>
        )}
        {ui.canSend && (
          <Button type="button" variant="outline" size="sm" onClick={sendTest}>
            Send test notification
          </Button>
        )}
      </div>

      {sent && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" /> Sent — check your lock screen.
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}

      <p className="text-xs text-muted-foreground">
        On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then open it
        from there. Reminders sent while the app is closed need a push server — coming later.
      </p>
    </div>
  );
}
