'use client';

/**
 * Transaction Volume Statistics 多序列折线图（源 `src/views/dashboard/
 * volume-chart.vue` v2.3 e591f85 React 1:1 移植；自绘 SVG，零图表依赖）。
 *
 * 几何与语义照源：viewBox 720×240、y 全域 min~max 归一化（全等 ±1 压中轴）、
 * 稀疏序列按窗口天数补 0、x 刻度 ≤7 天全标否则首/中/尾（MM-DD）、点悬停
 * title。上游 hex 禁止直写：固定 6 色板映射 tailwind 语义类（stroke 与 fill），
 * 网格线用主题 border token。
 */
import * as React from 'react';

/** 单序列单日点（day 'YYYY-MM-DD'，v 为成交额数值）。 */
export interface VolumePoint {
  day: string;

  v: number;
}

/** 按 token 对拆分的序列（name = `SRC→TGT`）。 */
export interface VolumeSeries {
  name: string;
  points: VolumePoint[];
}

interface VolumeChartProps {
  /** 窗口日期序列（升序，GMT+8 本地日切）。 */
  days: string[];
  series: VolumeSeries[];
}

const W = 720;
const H = 240;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 14;
const PLOT_H = H - PAD_T - 34;

/** 固定 6 色板（源 COLORS 的 tailwind 语义类映射，超出取模循环）。 */
const STROKE_CLASS = [
  'stroke-emerald-700',
  'stroke-amber-600',
  'stroke-teal-600',
  'stroke-orange-600',
  'stroke-blue-600',
  'stroke-purple-600',
] as const;
const FILL_CLASS = [
  'fill-emerald-700',
  'fill-amber-600',
  'fill-teal-600',
  'fill-orange-600',
  'fill-blue-600',
  'fill-purple-600',
] as const;

function strokeOf(i: number): string {
  return STROKE_CLASS[i % STROKE_CLASS.length];
}

function fillOf(i: number): string {
  return FILL_CLASS[i % FILL_CLASS.length];
}

/** 悬停值文本：整数千分位，非整数最多 4 位小数（源 fmt 1:1，en-US）。 */
function fmt(v: number): string {
  return Number.isInteger(v)
    ? v.toLocaleString('en-US')
    : v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function VolumeChart({ days, series }: VolumeChartProps) {
  const slots = Math.max(days.length, 1);
  const xF = (idx: number): number =>
    slots === 1
      ? PAD_L + (W - PAD_L - PAD_R) / 2
      : PAD_L + ((W - PAD_L - PAD_R) * idx) / (slots - 1);

  /** y 归一化全域 min~max；全等时 ±1 压中轴（源 bounds 1:1）。 */
  const [lo, hi] = React.useMemo<[number, number]>(() => {
    const all = series.flatMap((s) => s.points.map((p) => p.v));
    if (!all.length) return [0, 1];
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return [min, max];
  }, [series]);

  const yF = (v: number): number =>
    PAD_T + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;

  /** 稀疏序列按窗口天数对位补齐（缺日 = 0），idx 对应 days 下标（源 1:1）。 */
  const filled = React.useMemo(
    () =>
      series.map((s) => {
        const byDay = new Map(s.points.map((p) => [p.day.slice(5), p.v]));
        return {
          name: s.name,
          points: days.map((d, idx) => ({
            day: d,
            idx,
            v: byDay.get(d.slice(5)) ?? 0,
          })),
        };
      }),
    [series, days],
  );

  const xLabels = days.length
    ? (
        days.length <= 7
          ? days
          : [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]]
      ).map((d) => ({ text: d.slice(5), x: xF(days.indexOf(d)) }))
    : [];

  if (!filled.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No transaction volume data in the selected window.
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[240px] w-full"
        role="img"
        aria-label="Transaction volume trend"
      >
        {/* 网格 */}
        <g className="stroke-border" strokeWidth={1}>
          {[1, 2, 3].map((i) => (
            <line
              key={`grid-${i}`}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + (PLOT_H * i) / 4 - 8}
              y2={PAD_T + (PLOT_H * i) / 4 - 8}
            />
          ))}
        </g>
        {/* 序列折线与数据点（点悬停 title 显值） */}
        {filled.map((s, si) => (
          <g key={s.name}>
            <polyline
              points={s.points
                .map((p) => `${xF(p.idx)},${yF(p.v)}`)
                .join(' ')}
              fill="none"
              className={strokeOf(si)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points.map((p) => (
              <circle
                key={`${s.name}-${p.day}`}
                cx={xF(p.idx)}
                cy={yF(p.v)}
                r={3.5}
                className={`fill-background ${fillOf(si)}`}
                strokeWidth={1.5}
              >
                <title>{`${s.name} · ${p.day}: ${fmt(p.v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {/* x 轴刻度 */}
        {xLabels.map((lab) => (
          <text
            key={lab.text}
            x={lab.x}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            className="fill-muted-foreground"
          >
            {lab.text}
          </text>
        ))}
      </svg>
      {/* 图例：圆点 + 序列名 */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {filled.map((s, si) => (
          <span
            key={`legend-${s.name}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${fillOf(si)}`}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
