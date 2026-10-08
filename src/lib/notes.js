// notes.js — pure helpers for the Notes scratchpad.
//
// On load we may have a cached copy (written offline, updatedAt in epoch ms) and
// a server copy (updatedAt as an ISO string). pickNewerNote decides which the UI
// should show: last-write-wins by updatedAt, server winning ties. Keeping this
// pure makes the merge logic testable without the network or React.

// Normalize an updatedAt (epoch ms number, ISO string, or null) to epoch ms.
function toMs(updatedAt) {
  if (updatedAt == null) return 0;
  if (typeof updatedAt === 'number') return updatedAt;
  const ms = Date.parse(updatedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

// cache:  { content, updatedAt(ms) } | null
// server: { content, updatedAt(ISO) } | null
// → { content, updatedAt(ms), source: 'cache'|'server'|'empty' }
export function pickNewerNote(cache, server) {
  const c = cache ? { content: cache.content ?? '', updatedAt: toMs(cache.updatedAt), source: 'cache' } : null;
  const s = server ? { content: server.content ?? '', updatedAt: toMs(server.updatedAt), source: 'server' } : null;

  if (!c && !s) return { content: '', updatedAt: 0, source: 'empty' };
  if (!c) return s;
  if (!s) return c;
  // Both present: newer wins; server wins an exact tie (it's authoritative).
  return c.updatedAt > s.updatedAt ? c : s;
}
