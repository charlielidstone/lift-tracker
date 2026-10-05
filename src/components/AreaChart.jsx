// AreaChart — weekly totals as a Strava-style area chart, rendered with Recharts.
//
// Interface mirrors BarChart: points [{ label: string, y: number }] already in
// display units, plus an optional formatY for axis/tooltip formatting and an
// optional tooltipLabel for the value row. Straight line segments (linear),
// a gradient fill under the line, a dot on every week, and an emphasized dot
// on the most recent week. Colors use the app's theme CSS vars.

import {
  Area,
  AreaChart as RAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function AreaChart({
  points,
  formatY = (v) => String(Math.round(v)),
  tooltipLabel = '',
}) {
  if (!points || points.length === 0) {
    return <p className="text-xs text-muted-foreground">No data yet.</p>;
  }

  const data = points.map((p) => ({ label: p.label ?? '', y: p.y }));
  const lastIndex = data.length - 1;

  // Emphasize only the most recent week's dot (larger, filled).
  const renderDot = (props) => {
    const { cx, cy, index, key } = props;
    if (cx == null || cy == null) return <g key={key} />;
    const emphasized = index === lastIndex;
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={emphasized ? 5 : 3}
        fill={emphasized ? 'var(--accent-foreground)' : 'var(--card)'}
        stroke="var(--accent-foreground)"
        strokeWidth={2}
      />
    );
  };

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="weeklyAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-foreground)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent-foreground)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={24}
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
            cursor={{ stroke: 'var(--border)' }}
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
          <Area
            type="linear"
            dataKey="y"
            stroke="var(--accent-foreground)"
            strokeWidth={2}
            fill="url(#weeklyAreaFill)"
            dot={renderDot}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
