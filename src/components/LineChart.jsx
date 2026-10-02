// LineChart — a tiny hand-rolled SVG line chart. No charting dependency.
//
// Takes points [{ x: number, y: number, label?: string }] already in display
// units, scales them into a fixed viewBox, and draws a path + dots. Responsive
// via viewBox (width 100%, fixed aspect). Colors use theme CSS vars.
//
// Kept dumb on purpose: callers do the data shaping (progress.js) and unit
// conversion; this only draws.

const W = 320;
const H = 140;
const PAD = { top: 12, right: 10, bottom: 20, left: 34 };

export function LineChart({ points, formatY = (v) => String(Math.round(v)) }) {
  if (!points || points.length === 0) {
    return <p className="text-xs text-muted-foreground">No data yet.</p>;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  // Pad the y-range so a flat/near-flat line isn't glued to an edge.
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  } else {
    const margin = (maxY - minY) * 0.1;
    minY -= margin;
    maxY += margin;
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const sx = (x) => PAD.left + (maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW);
  const sy = (y) => PAD.top + (1 - (y - minY) / (maxY - minY)) * plotH;

  const coords = points.map((p) => ({ cx: sx(p.x), cy: sy(p.y), ...p }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');

  // Single point: just a dot, no line.
  const firstLabel = points[0].label;
  const lastLabel = points[points.length - 1].label;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ aspectRatio: `${W} / ${H}` }}
      role="img"
      aria-label="Progress chart"
    >
      {/* y-axis min/max ticks */}
      <text x={PAD.left - 4} y={sy(maxY) + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">
        {formatY(maxY)}
      </text>
      <text x={PAD.left - 4} y={sy(minY) + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">
        {formatY(minY)}
      </text>
      {/* baseline */}
      <line
        x1={PAD.left}
        y1={PAD.top + plotH}
        x2={W - PAD.right}
        y2={PAD.top + plotH}
        stroke="var(--border)"
        strokeWidth="1"
      />
      {coords.length > 1 && (
        <path d={path} fill="none" stroke="var(--accent-foreground)" strokeWidth="2" />
      )}
      {coords.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r="3" fill="var(--accent-foreground)" />
      ))}
      {/* x-axis first/last date labels */}
      <text x={PAD.left} y={H - 6} textAnchor="start" fontSize="9" fill="var(--muted-foreground)">
        {firstLabel}
      </text>
      {points.length > 1 && (
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">
          {lastLabel}
        </text>
      )}
    </svg>
  );
}
