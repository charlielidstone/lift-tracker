// pushSubscribe — the client half of REAL server-sent notifications.
//
// Thin wrapper over the Push API + the ONE module that saves/removes a device's
// PushSubscription in Supabase. The (supported, permission, subscribed) → UI
// decision is the PURE, tested `pushUiState` below; the browser/DB calls are the
// un-pure wrappers. Mirrors notifications.js (local demo) / notifyUiState.
//
// A PushSubscription is THIS device's unique mailbox at the OS push service. We
// store one row per device in `push_subscriptions` (migration 009), keyed by its
// `endpoint`, so re-subscribing the same device upserts rather than duplicates.
// The Edge Function later reads these (service_role) to deliver a push.

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// True only when a VAPID public key is configured — without it we can't subscribe.
export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY);

// PURE: the VAPID public key is base64url text; the Push API wants a Uint8Array
// (`applicationServerKey`). Standard conversion, testable without a browser.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// True where the Push API is actually available (needs a service worker + PushManager).
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// PURE: map the full state → the Reminders UI. `configured` = VAPID key present,
// `signedIn` = we have a user to own the row (RLS needs auth.uid() = user_id).
export function pushUiState({ supported, permission, subscribed, signedIn, configured }) {
  if (!configured) {
    return {
      status: 'unconfigured',
      label: 'Server reminders aren’t configured on this build yet.',
      canSubscribe: false,
      canUnsubscribe: false,
    };
  }
  if (!supported || permission === 'unsupported') {
    return {
      status: 'unsupported',
      label: 'Push isn’t supported here. On iPhone, add the app to your Home Screen first.',
      canSubscribe: false,
      canUnsubscribe: false,
    };
  }
  if (permission === 'denied') {
    return {
      status: 'denied',
      label: 'Blocked — turn notifications on for this app in your device settings.',
      canSubscribe: false,
      canUnsubscribe: false,
    };
  }
  if (!signedIn) {
    return {
      status: 'signin',
      label: 'Sign in to get reminders on this device.',
      canSubscribe: false,
      canUnsubscribe: false,
    };
  }
  if (subscribed) {
    return {
      status: 'subscribed',
      label: 'Reminders are on for this device.',
      canSubscribe: false,
      canUnsubscribe: true,
    };
  }
  return {
    status: 'ready',
    label: 'Get reminders even when the app is closed.',
    canSubscribe: true,
    canUnsubscribe: false,
  };
}

// The already-registered subscription for THIS device, or null.
export async function getExistingSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Subscribe this device to push (permission must already be granted — prompt
// from a user gesture first on iOS). Returns the PushSubscription.
export async function subscribeDevice() {
  if (!isPushConfigured) throw new Error('push-not-configured');
  if (!pushSupported()) throw new Error('push-unsupported');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true, // required by browsers: every push must show a notification
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

// Upsert this device's subscription into Supabase (keyed by endpoint). RLS
// requires the row be owned by the signed-in user, so `userId` is required.
export async function savePushSubscription(subscription, userId) {
  if (!isSupabaseConfigured) throw new Error('supabase-not-configured');
  if (!userId) throw new Error('not-signed-in');
  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      subscription: json,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

// Unsubscribe this device and remove its row. Best-effort on the DB delete so an
// offline delete still tears down the local subscription.
export async function unsubscribeDevice() {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (isSupabaseConfigured) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}
