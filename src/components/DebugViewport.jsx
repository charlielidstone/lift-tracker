// TEMPORARY diagnostic overlay — reads the ACTUAL viewport + safe-area values on
// the device so we can position the nav exactly. Remove after measuring.

import { useEffect, useState } from 'react';

export function DebugViewport() {
  const [info, setInfo] = useState('measuring…');
  useEffect(() => {
    const probe = document.createElement('div');
    // width encodes inset-bottom, height encodes inset-top (so one element gives both)
    probe.style.cssText =
      'position:fixed;top:0;left:0;height:env(safe-area-inset-top);width:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
    const satTop = probe.offsetHeight;
    const satBottom = probe.offsetWidth;
    probe.remove();
    const nav = document.querySelector('nav');
    const navR = nav ? nav.getBoundingClientRect() : { top: 0, bottom: 0 };
    const shell = document.querySelector('[data-shell]');
    const shR = shell ? shell.getBoundingClientRect() : { top: 0, bottom: 0 };
    setInfo(
      `iw${window.innerWidth} ih${window.innerHeight} dpr${window.devicePixelRatio} | ` +
        `SA top${satTop} bot${satBottom} | ` +
        `shell ${Math.round(shR.top)}→${Math.round(shR.bottom)} | ` +
        `nav ${Math.round(navR.top)}→${Math.round(navR.bottom)} | ` +
        `docCH${document.documentElement.clientHeight}`,
    );
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(220,0,0,0.9)',
        color: '#fff',
        fontSize: '11px',
        lineHeight: '1.3',
        padding: '3px 5px',
        fontFamily: 'monospace',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      {info}
    </div>
  );
}
