// NotificationsDemo — notification controls in Settings.
//
// Two layers, honestly separated:
//  1. LOCAL test: prove the device can show a lock-screen notification, no
//     backend. Fires only while the app is open/recently-open.
//  2. REMINDERS (server push): subscribe this device so the server can notify it
//     even when the app is fully closed (needs the installed PWA + VAPID + the
//     Edge Function sender). This block does the client half — mint + store the
//     PushSubscription; the actual sending comes with the Edge Function/cron.

import { useEffect, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  notificationsSupported,
  getPermission,
  requestPermission,
  sendTestNotification,
  notifyUiState,
} from '@/lib/notifications';
import {
  isPushConfigured,
  pushSupported,
  pushUiState,
  getExistingSubscription,
  subscribeDevice,
  savePushSubscription,
  unsubscribeDevice,
} from '@/lib/pushSubscribe';

export function NotificationsDemo() {
  const { user } = useAuth();
  const [permission, setPermission] = useState(() => getPermission());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  // Reminders (server push) state.
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState(null);

  // On mount / when permission changes, reflect whether this device already has
  // a push subscription so the button shows On vs Off correctly.
  useEffect(() => {
    let alive = true;
    getExistingSubscription()
      .then((sub) => {
        if (alive) setSubscribed(Boolean(sub));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [permission]);

  const ui = notifyUiState({ supported: notificationsSupported(), permission });
  const pui = pushUiState({
    supported: pushSupported(),
    permission,
    subscribed,
    signedIn: Boolean(user),
    configured: isPushConfigured,
  });

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

  // Turn ON reminders: ensure permission (user gesture), subscribe, store the row.
  const enableReminders = async () => {
    setPushError(null);
    setBusy(true);
    try {
      let perm = permission;
      if (perm !== 'granted') {
        perm = await requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') {
        setPushError('Allow notifications to turn reminders on.');
        return;
      }
      const sub = await subscribeDevice();
      await savePushSubscription(sub, user?.id);
      setSubscribed(true);
    } catch {
      setPushError('Could not enable reminders. On iPhone, open the app from the Home Screen.');
    } finally {
      setBusy(false);
    }
  };

  const disableReminders = async () => {
    setPushError(null);
    setBusy(true);
    try {
      await unsubscribeDevice();
      setSubscribed(false);
    } catch {
      setPushError('Could not turn reminders off.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Local test */}
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
      </div>

      {/* Reminders (server push) */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Reminders</span>
          <p className="text-xs text-muted-foreground">{pui.label}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pui.canSubscribe && (
            <Button type="button" size="sm" disabled={busy} onClick={enableReminders}>
              <Bell className="size-3.5" /> Turn on reminders
            </Button>
          )}
          {pui.canUnsubscribe && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={disableReminders}
            >
              <BellOff className="size-3.5" /> Turn off reminders
            </Button>
          )}
        </div>

        {pushError && <span className="text-xs text-destructive">{pushError}</span>}
      </div>

      <p className="text-xs text-muted-foreground">
        On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then open it
        from there. Reminders need the installed app.
      </p>
    </div>
  );
}
