// BarChart — weekly totals bar chart, rendered with Recharts.
//
// Interface mirrors LineChart: bars [{ label: string, y: number }] already in
// display units, plus an optional formatY for axis/tooltip formatting and an
// optional tooltipLabel for the value row. Colors use the app's theme CSS vars.

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function BarChart({
  bars,
  formatY = (v) => String(Math.round(v)),
  tooltipLabel = '',
}) {
  if (!bars || bars.length === 0) {
    return <p className="text-xs text-muted-foreground">No data yet.</p>;
  }

  const data = bars.map((b) => ({ label: b.label ?? '', y: b.y }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={8}
          />
          <YAxis
            width={38}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            formatter={(value) => [formatY(value), tooltipLabel]}
            labelFormatter={(label) => `Week of ${label}`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--foreground)',
            }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
          />
          <Bar
            dataKey="y"
            fill="var(--accent-foreground)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
