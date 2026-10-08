import { describe, expect, it } from 'vitest';
import { parsePersistedSession, readPersistedSession } from '@/lib/authSession';

// Minimal Storage-like fake backed by a plain object.
function fakeStorage(obj) {
  const keys = Object.keys(obj);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => (k in obj ? obj[k] : null),
  };
}

const session = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: 1234,
  user: { id: 'u1', email: 'x@y.z' },
};

describe('parsePersistedSession', () => {
  it('parses a v2 session stored directly', () => {
    expect(parsePersistedSession(JSON.stringify(session))).toEqual(session);
  });

  it('unwraps a v1 { currentSession } shape', () => {
    expect(parsePersistedSession(JSON.stringify({ currentSession: session }))).toEqual(session);
  });

  it('returns null for a session without a user', () => {
    expect(parsePersistedSession(JSON.stringify({ access_token: 'a' }))).toBeNull();
  });

  it('returns null for null / empty / invalid JSON', () => {
    expect(parsePersistedSession(null)).toBeNull();
    expect(parsePersistedSession('')).toBeNull();
    expect(parsePersistedSession('{not json')).toBeNull();
  });
});

describe('readPersistedSession', () => {
  it('finds the sb-*-auth-token key and returns its session', () => {
    const s = fakeStorage({
      'theme': 'dark',
      'sb-mnrljxvyhlcydpkuaikb-auth-token': JSON.stringify(session),
    });
    expect(readPersistedSession(s)).toEqual(session);
  });

  it('returns null when no auth-token key exists', () => {
    expect(readPersistedSession(fakeStorage({ foo: 'bar' }))).toBeNull();
  });

  it('returns null for null storage', () => {
    expect(readPersistedSession(null)).toBeNull();
  });

  it('ignores a malformed token value', () => {
    const s = fakeStorage({ 'sb-ref-auth-token': '{broken' });
    expect(readPersistedSession(s)).toBeNull();
  });
});
