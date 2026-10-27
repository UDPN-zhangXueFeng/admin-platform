'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@myorg/shared/util-classnames';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'];

export interface PieCardProps {
  title: string;
  count: number;
  chartData?: { name: string; value: number }[];
  showChart?: boolean;
  className?: string;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--popover-foreground))',
    fontSize: 12,
  },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

/**
 * Overview statistic card. Theme-safe (surface/border tokens only) and the
 * proportion slice is readable through a tooltip with share percentages plus
 * a wrapped dot legend underneath.
 */
export function StatisticsPieCard({
  title,
  count,
  chartData,
  showChart = true,
  className,
}: PieCardProps) {
  const data = React.useMemo(() => chartData ?? [], [chartData]);
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <div className={cn('flex h-full flex-col rounded-lg border bg-card p-4', className)}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mb-2 text-2xl font-bold">{count}</div>
      {showChart && data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={52}
                paddingAngle={2}
                strokeWidth={0}
                dataKey="value"
                nameKey="name"
                isAnimationActive={false}
              >
                {data.map((item, index) => (
                  <Cell
                    key={item.name ?? index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name) => [
                  total > 0
                    ? `${value} (${Math.round((Number(value) / total) * 100)}%)`
                    : String(value),
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {data.map((item, index) => (
              <li key={item.name ?? index} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  aria-hidden
                />
                <span className="max-w-28 truncate" title={item.name}>
                  {item.name}
                </span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
