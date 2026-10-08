import { describe, expect, it } from 'vitest';
import { pickNewerNote } from '@/lib/notes';

describe('pickNewerNote', () => {
  it('returns empty when neither copy exists', () => {
    expect(pickNewerNote(null, null)).toEqual({ content: '', updatedAt: 0, source: 'empty' });
  });

  it('uses the cache when there is no server copy', () => {
    const r = pickNewerNote({ content: 'local', updatedAt: 100 }, null);
    expect(r).toMatchObject({ content: 'local', source: 'cache' });
  });

  it('uses the server when there is no cache', () => {
    const r = pickNewerNote(null, { content: 'remote', updatedAt: '2026-10-05T00:00:00Z' });
    expect(r.content).toBe('remote');
    expect(r.source).toBe('server');
  });

  it('picks the newer copy when both exist (cache newer)', () => {
    const serverMs = Date.parse('2026-10-05T00:00:00Z');
    const r = pickNewerNote(
      { content: 'newer local', updatedAt: serverMs + 5000 },
      { content: 'older remote', updatedAt: '2026-10-05T00:00:00Z' },
    );
    expect(r.content).toBe('newer local');
    expect(r.source).toBe('cache');
  });

  it('picks the newer copy when both exist (server newer)', () => {
    const r = pickNewerNote(
      { content: 'older local', updatedAt: 1000 },
      { content: 'newer remote', updatedAt: '2026-10-05T00:00:00Z' },
    );
    expect(r.content).toBe('newer remote');
    expect(r.source).toBe('server');
  });

  it('server wins an exact tie', () => {
    const iso = '2026-10-05T00:00:00Z';
    const r = pickNewerNote(
      { content: 'local', updatedAt: Date.parse(iso) },
      { content: 'remote', updatedAt: iso },
    );
    expect(r.source).toBe('server');
  });

  it('treats a missing/invalid updatedAt as oldest', () => {
    const r = pickNewerNote(
      { content: 'local', updatedAt: 500 },
      { content: 'remote', updatedAt: 'not-a-date' },
    );
    expect(r.content).toBe('local'); // server parsed to 0
  });
});
