// notifications.js — thin wrapper over the Web Notifications + Service Worker
// showNotification API.
//
// This is a LOCAL notification demo: it proves the device can surface a
// lock-screen notification WITHOUT a push backend. On iOS this ONLY works when
// the app is installed to the Home Screen (Share -> Add to Home Screen) and the
// user has granted permission. Real server push (firing a reminder when the app
// is fully closed) needs VAPID keys + a push server/Edge Function — a later slice.

const TEST_TITLE = 'Lift Tracker';
const TEST_OPTIONS = {
  body: 'Test notification — this is how a reminder will look. 💪',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  tag: 'lift-test',
};

// True only where we can actually request + show a notification.
export function notificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

// 'unsupported' | 'default' | 'granted' | 'denied'
export function getPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Prompt for permission (must be called from a user gesture on iOS).
// Resolves to the resulting permission string.
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

// Fire a test notification. iOS requires the Service Worker path
// (registration.showNotification) — the Notification constructor is not
// supported there. The constructor branch is a desktop-dev fallback only
// (the dev build has no SW).
export async function sendTestNotification() {
  if (getPermission() !== 'granted') {
    throw new Error('permission-not-granted');
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(TEST_TITLE, TEST_OPTIONS);
    return;
  }
  // Desktop-dev fallback (no SW registered): not used on iOS.
  // eslint-disable-next-line no-new
  new Notification(TEST_TITLE, TEST_OPTIONS);
}

// PURE: map (supported, permission) -> the demo UI's state. Tested.
export function notifyUiState({ supported, permission }) {
  if (!supported || permission === 'unsupported') {
    return {
      status: 'unsupported',
      label: 'Notifications are not supported on this browser.',
      canEnable: false,
      canSend: false,
    };
  }
  if (permission === 'denied') {
    return {
      status: 'denied',
      label: 'Blocked — turn notifications on for this app in your device settings.',
      canEnable: false,
      canSend: false,
    };
  }
  if (permission === 'granted') {
    return {
      status: 'granted',
      label: 'Notifications are on. Send yourself a test.',
      canEnable: false,
      canSend: true,
    };
  }
  return {
    status: 'default',
    label: 'Notifications are off. Enable them to get a test notification.',
    canEnable: true,
    canSend: false,
  };
}
