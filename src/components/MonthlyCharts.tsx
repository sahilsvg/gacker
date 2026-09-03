import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, TooltipProps,
} from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { MonthlyStats } from '@/lib/entries';

// hsl(var(--x)) rather than a Tailwind class: recharts needs a literal CSS
// color value for stroke/fill, not a className.
const RED = 'hsl(var(--red))';
const MUTED = 'hsl(var(--muted-foreground))';
const BORDER = 'hsl(var(--border))';

const axisProps = {
  tick: { fill: MUTED, fontSize: 10 },
  tickLine: false,
  axisLine: { stroke: BORDER },
};

const ChartTooltip = (
  { active, payload, label, suffix }: TooltipProps<ValueType, NameType> & { suffix: string },
) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground font-semibold">
        {value === null ? 'No data' : `${value}${suffix}`}
      </p>
    </div>
  );
};

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="mb-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
    <div style={{ width: '100%', height: 180 }}>{children}</div>
  </div>
);

export const FireRateChart = ({ data }: { data: MonthlyStats[] }) => (
  <ChartCard title="Fire Rate Over Time" subtitle="Red days as a share of days logged, by month">
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={BORDER} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axisProps} />
        {/* Explicit ticks rather than recharts' auto-generated ones: against a
            fixed [0,100] domain with a tightly clustered dataset (fire rates
            usually sit in a narrow band), auto tick placement produced
            garbled, repeating labels at this chart's height. */}
        <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} width={40} />
        <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ stroke: BORDER }} />
        {/* connectNulls=false: a month with nothing logged is a gap, not 0%. */}
        <Line
          type="monotone"
          dataKey="fireRate"
          stroke={RED}
          strokeWidth={2}
          dot={{ r: 3, fill: RED, strokeWidth: 0 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const GoonsPerMonthChart = ({ data }: { data: MonthlyStats[] }) => (
  <ChartCard title="Goons/Mo Over Time" subtitle="Red days logged, by month">
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={BORDER} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} width={28} />
        <Tooltip content={<ChartTooltip suffix="" />} cursor={{ fill: BORDER, opacity: 0.3 }} />
        <Bar dataKey="redDays" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);
