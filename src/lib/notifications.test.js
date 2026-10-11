import { describe, it, expect } from 'vitest';
import { notifyUiState } from './notifications.js';

describe('notifyUiState', () => {
  it('reports unsupported when the browser lacks support', () => {
    const s = notifyUiState({ supported: false, permission: 'default' });
    expect(s.status).toBe('unsupported');
    expect(s.canEnable).toBe(false);
    expect(s.canSend).toBe(false);
  });

  it('reports unsupported when permission itself is unsupported', () => {
    const s = notifyUiState({ supported: true, permission: 'unsupported' });
    expect(s.status).toBe('unsupported');
    expect(s.canSend).toBe(false);
  });

  it('offers to enable when permission is default', () => {
    const s = notifyUiState({ supported: true, permission: 'default' });
    expect(s.status).toBe('default');
    expect(s.canEnable).toBe(true);
    expect(s.canSend).toBe(false);
  });

  it('allows sending once granted', () => {
    const s = notifyUiState({ supported: true, permission: 'granted' });
    expect(s.status).toBe('granted');
    expect(s.canEnable).toBe(false);
    expect(s.canSend).toBe(true);
  });

  it('blocks both actions when denied', () => {
    const s = notifyUiState({ supported: true, permission: 'denied' });
    expect(s.status).toBe('denied');
    expect(s.canEnable).toBe(false);
    expect(s.canSend).toBe(false);
  });
});
