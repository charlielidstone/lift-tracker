// pushSubscribe — unit tests for the PURE helpers only (urlBase64ToUint8Array +
// pushUiState). The browser/DB wrappers (subscribeDevice, savePushSubscription…)
// need a service worker + Supabase and are exercised on the deployed build.

import { describe, expect, it } from 'vitest';
import { pushUiState, urlBase64ToUint8Array } from './pushSubscribe.js';

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url (— and _) without padding to the right bytes', () => {
    // "Ma" in standard base64 is "TWE="; base64url drops padding.
    const out = urlBase64ToUint8Array('TWE');
    expect(Array.from(out)).toEqual([77, 97]); // 'M','a'
  });

  it('handles the - and _ url-safe chars', () => {
    // 0xFB 0xFF encodes to "+/8=" standard / "-_8" base64url.
    const out = urlBase64ToUint8Array('-_8');
    expect(Array.from(out)).toEqual([251, 255]);
  });

  it('produces a 65-byte array for a real VAPID public key', () => {
    const key =
      'BEyZtrvAB-lg1eSaFEtl92xZfodYt7G3w6BTn89jBH_i54ComNHkNOL9waf1Bsf5qDcx35CXb9q0kIjrT-V2lMo';
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });
});

describe('pushUiState', () => {
  const base = {
    supported: true,
    permission: 'default',
    subscribed: false,
    signedIn: true,
    configured: true,
  };

  it('unconfigured when no VAPID key', () => {
    const ui = pushUiState({ ...base, configured: false });
    expect(ui.status).toBe('unconfigured');
    expect(ui.canSubscribe).toBe(false);
  });

  it('unsupported takes priority over sign-in state', () => {
    const ui = pushUiState({ ...base, supported: false, signedIn: false });
    expect(ui.status).toBe('unsupported');
  });

  it('denied when permission is denied', () => {
    const ui = pushUiState({ ...base, permission: 'denied' });
    expect(ui.status).toBe('denied');
    expect(ui.canSubscribe).toBe(false);
  });

  it('asks to sign in when supported + allowed but no user', () => {
    const ui = pushUiState({ ...base, signedIn: false });
    expect(ui.status).toBe('signin');
    expect(ui.canSubscribe).toBe(false);
  });

  it('ready to subscribe when everything is set and not yet subscribed', () => {
    const ui = pushUiState(base);
    expect(ui.status).toBe('ready');
    expect(ui.canSubscribe).toBe(true);
    expect(ui.canUnsubscribe).toBe(false);
  });

  it('subscribed exposes unsubscribe only', () => {
    const ui = pushUiState({ ...base, subscribed: true });
    expect(ui.status).toBe('subscribed');
    expect(ui.canSubscribe).toBe(false);
    expect(ui.canUnsubscribe).toBe(true);
  });
});
