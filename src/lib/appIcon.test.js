// appIcon — unit tests for icon resolution + applying the apple-touch-icon link.
// Uses a hand-rolled fake document so the test needs no DOM environment.

import { describe, expect, it } from 'vitest';
import { APP_ICON_IDS, appIconById, applyAppIcon, DEFAULT_APP_ICON } from './appIcon.js';

function fakeDoc(existingLink = null) {
  const head = {
    children: [],
    appendChild(el) {
      this.children.push(el);
    },
  };
  return {
    head,
    _link: existingLink,
    querySelector(sel) {
      if (sel === 'link[rel="apple-touch-icon"]') return this._link;
      return null;
    },
    createElement() {
      const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      return el;
    },
  };
}

describe('appIconById', () => {
  it('resolves a known id', () => {
    expect(appIconById('cream').id).toBe('cream');
  });
  it('falls back to the default for an unknown id', () => {
    expect(appIconById('nope').id).toBe(DEFAULT_APP_ICON);
    expect(appIconById(undefined).id).toBe(DEFAULT_APP_ICON);
  });
});

describe('applyAppIcon', () => {
  it('creates an apple-touch-icon link when none exists and sets its href', () => {
    const doc = fakeDoc(null);
    const applied = applyAppIcon('cream', doc);
    expect(applied).toBe('cream');
    expect(doc.head.children).toHaveLength(1);
    expect(doc.head.children[0].rel).toBe('apple-touch-icon');
    expect(doc.head.children[0].attrs.href).toContain('/app-icons/cream/');
  });

  it('reuses an existing link and repoints its href', () => {
    const link = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const doc = fakeDoc(link);
    applyAppIcon('purple', doc);
    expect(doc.head.children).toHaveLength(0); // did not create a new one
    expect(link.attrs.href).toContain('/app-icons/purple/');
  });

  it('applies the default icon for an unknown id', () => {
    const doc = fakeDoc(null);
    const applied = applyAppIcon('bogus', doc);
    expect(applied).toBe(DEFAULT_APP_ICON);
  });

  it('is a no-op-safe return when there is no document head', () => {
    expect(applyAppIcon('cream', {})).toBe('cream');
  });
});

describe('APP_ICON_IDS', () => {
  it('includes the default', () => {
    expect(APP_ICON_IDS).toContain(DEFAULT_APP_ICON);
  });
});
