// appIcon — selectable home-screen / app icon.
//
// iOS reality: a web app CANNOT live-swap an already-installed home-screen icon.
// Safari reads <link rel="apple-touch-icon"> at "Add to Home Screen" time and
// bakes it in. So this only changes which icon the PAGE ADVERTISES — the choice
// takes effect the next time the user adds (or removes + re-adds) to the home
// screen. We keep it simple and just repoint the apple-touch-icon link.

export const APP_ICONS = [
  { id: 'purple', label: 'Purple', src: '/app-icons/purple/apple-touch-icon.png' },
  { id: 'cream', label: 'Cream', src: '/app-icons/cream/apple-touch-icon.png' },
];

export const DEFAULT_APP_ICON = 'purple';

export const APP_ICON_IDS = APP_ICONS.map((i) => i.id);

// Resolve an id to its icon def, falling back to the default for anything unknown.
export function appIconById(id) {
  return (
    APP_ICONS.find((i) => i.id === id) ?? APP_ICONS.find((i) => i.id === DEFAULT_APP_ICON)
  );
}

// Point the document's apple-touch-icon link at the chosen variant (creating the
// link if the page somehow lacks one). `doc` is injectable for testing. Returns
// the id actually applied.
export function applyAppIcon(id, doc = globalThis.document) {
  const icon = appIconById(id);
  if (!doc?.head) return icon.id;
  let link = doc.querySelector('link[rel="apple-touch-icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'apple-touch-icon';
    doc.head.appendChild(link);
  }
  link.setAttribute('href', icon.src);
  return icon.id;
}
