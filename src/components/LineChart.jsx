// LineChart — progress line chart, rendered with Recharts.
//
// Keeps the same interface as the previous hand-rolled SVG version so callers
// don't change: points [{ x: number, y: number, label?: string }] already in
// display units, plus an optional formatY for axis/tooltip formatting. The x
// values are evenly-spaced session indices; `label` holds the real date shown
// on the axis + tooltip. Colors use the app's theme CSS vars.

import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function LineChart({ points, formatY = (v) => String(Math.round(v)) }) {
  if (!points || points.length === 0) {
    return <p className="text-xs text-muted-foreground">No data yet.</p>;
  }

  // Recharts wants an array of row objects; carry the date label for the axis.
  const data = points.map((p) => ({ x: p.x, y: p.y, label: p.label ?? '' }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={16}
          />
          <YAxis
            width={38}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip
            formatter={(value) => [formatY(value), '']}
            labelFormatter={(label) => label}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--foreground)',
            }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="var(--accent-foreground)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--accent-foreground)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
