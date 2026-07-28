'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'];

export interface PieCardProps {
  title: string;
  count: number;
  chartData?: { name: string; value: number }[];
  showChart?: boolean;
}

export function StatisticsPieCard({ title, count, chartData, showChart = true }: PieCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border h-full">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="text-2xl font-bold mb-2">{count}</div>
      {showChart && chartData && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" nameKey="name">
              {chartData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
