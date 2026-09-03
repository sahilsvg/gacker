import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, TooltipProps,
} from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { MonthlyStats, CumulativeFireRatePoint } from '@/lib/entries';

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

// Shared by both charts' YAxis + chart margin so their plot areas start at
// the exact same x regardless of how wide each chart's own labels are
// ("100%" vs a single digit) -- a per-chart width sized to its own longest
// label is what had them misaligned before, each with a different amount of
// dead space to its left.
const Y_AXIS_WIDTH = 34;
const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 };

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
    {/* touch-action: pan-y is the axis lock: recharts tracks touch itself to
        move the tooltip as a finger drags across the chart, but nothing was
        stopping the page's own vertical scroll from also engaging on the same
        drag. pan-y tells iOS only vertical panning is native here, so a
        mostly-horizontal drag never reaches the scrollable page behind it --
        same mechanism as the calendar's month swipe and the profile tab
        deck, just CSS-only here since nothing needs to be dragged/panned by
        hand, only kept from fighting the chart's own touch tracking. */}
    <div style={{ width: '100%', height: 180, touchAction: 'pan-y' }}>{children}</div>
  </div>
);

export const FireRateChart = ({ data }: { data: CumulativeFireRatePoint[] }) => {
  // Thin the axis labels to roughly six regardless of how many days are in
  // the dataset -- the data itself stays daily, only the printed ticks skip.
  const tickInterval = Math.max(0, Math.ceil(data.length / 6) - 1);

  return (
    <ChartCard title="Fire Rate Over Time" subtitle="The progress of your daily fire rate.">
      <ResponsiveContainer>
        <LineChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke={BORDER} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axisProps} interval={tickInterval} />
          {/* Explicit ticks rather than recharts' auto-generated ones: against a
              fixed [0,100] domain with a tightly clustered dataset (fire rates
              usually sit in a narrow band), auto tick placement produced
              garbled, repeating labels at this chart's height. */}
          <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} width={Y_AXIS_WIDTH} />
          <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ stroke: BORDER }} />
          {/* Every point has a real value now (today's running rate carried
              through gap days), so the line is always continuous -- nothing to
              connectNulls across. No per-day dots: with daily granularity that
              is a dot for every single day in the history, which reads as
              noise rather than signal. activeDot (recharts' default) still
              marks the point under a finger while dragging across the line. */}
          <Line type="monotone" dataKey="fireRate" stroke={RED} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const GoonsPerMonthChart = ({ data }: { data: MonthlyStats[] }) => (
  <ChartCard title="Goons Per Month" subtitle="Red days logged, by month.">
    <ResponsiveContainer>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={BORDER} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} width={Y_AXIS_WIDTH} />
        <Tooltip content={<ChartTooltip suffix="" />} cursor={{ fill: BORDER, opacity: 0.3 }} />
        <Bar dataKey="redDays" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);
