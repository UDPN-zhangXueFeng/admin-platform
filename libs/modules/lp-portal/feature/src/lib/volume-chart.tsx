'use client';

/**
 * Transaction Volume Statistics 多序列折线图（源 `src/views/dashboard/
 * volume-chart.vue` f0d5b6f 4d20380 v2 重写；自绘 SVG，零图表依赖）。
 *
 * v2 几何与语义（照源）：
 * - viewBox 720×240，pad {l:52, r:14, t:14, b:30}，preserveAspectRatio="none"
 *   拉伸铺满（容器 h-auto w-full）；网格/十字线 vectorEffect 保 1px。
 * - y 轴 0~nice max（1/2/5×10^n 向上取整；raw max ≤0 → 1），4 段刻度网格 +
 *   DOM compact 标签（≥1M→'M'、≥1k→'k'，两位小数封顶）。
 * - 渐变面积 + Catmull-Rom→Bezier 平滑曲线；单点序列画 x±4 水平线。
 * - hover 十字线（mousemove 换算 viewBox 坐标，pad 外 6px 置 null，
 *   idx=round(ratio×(slots-1))）+ DOM 气泡（day + 每序列 dot/name/fmt；
 *   left 按比例定位 ratio>0.6 翻左，pointer-events-none）。
 * - 图例可点击隐藏（hidden Set，off 态 line-through+muted）；全隐藏与无数据
 *   两种空态分文案；色按原始序列 index 稳定分配（上游隐藏后重排为呈现 bug，
 *   不复刻，01 §D20 已记偏差）。
 * - 上游 hex 禁止直写：渐变 stop 用 currentColor（linearGradient 挂
 *   text-<palette> 类从 color 继承），线/点用 stroke 与 fill 语义类。
 */
import * as React from 'react';
import { ChartLine } from 'lucide-react';

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
  /** 窗口日序列（升序 'YYYY-MM-DD'），x 轴槽位由它决定。 */
  days: string[];
  series: VolumeSeries[];
}

const W = 720;
const H = 240;
const PAD_L = 52;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_H = H - PAD_T - PAD_B;

/** 固定 6 色板（源 COLORS 的 tailwind 语义类映射，超出取模循环）。 */
const COLOR_CLASS = [
  'emerald-700',
  'amber-600',
  'teal-600',
  'orange-600',
  'blue-600',
  'purple-600',
] as const;

/** 序列 i 的 text-<palette>（渐变 stop currentColor 的取色源）。 */
function textOf(i: number): string {
  return `text-${COLOR_CLASS[i % COLOR_CLASS.length]}`;
}

/** 序列 i 的 stroke 语义类。 */
function strokeOf(i: number): string {
  return `stroke-${COLOR_CLASS[i % COLOR_CLASS.length]}`;
}

/** 悬停/气泡值文本：en-US 千分位，最多 2 位小数（v2 源 fmt）。 */
function fmt(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** y 轴 compact 刻度文本：≥1M→'M'、≥1k→'k'（两位小数封顶）。 */
function compactLabel(v: number): string {
  if (v >= 1_000_000) return `${trim2(v / 1_000_000)}M`;
  if (v >= 1_000) return `${trim2(v / 1_000)}k`;
  return trim2(v);
}

function trim2(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** nice max：向上取到 1/2/5×10^n 阶梯；raw max ≤0 → 1（v2 源 niceMax）。 */
function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * base) return m * base;
  }
  return 10 * base;
}

/**
 * 平滑曲线路径：Catmull-Rom → 三次 Bezier（控制点 c1=p1+(p2-p0)/6、
 * c2=p2-(p3-p1)/6，端点用相邻点补位）；单点画 x±4 水平线（源 1:1）。
 */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (!pts.length) return '';
  if (pts.length === 1) {
    const { x, y } = pts[0];
    return `M ${x - 4} ${y} L ${x + 4} ${y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function VolumeChart({ days, series }: VolumeChartProps) {
  const uid = React.useId();
  const slots = Math.max(days.length, 1);
  const xF = (idx: number): number =>
    slots === 1
      ? PAD_L + (W - PAD_L - PAD_R) / 2
      : PAD_L + ((W - PAD_L - PAD_R) * idx) / (slots - 1);

  /** 图例隐藏集（名称键；色仍按原始 index 分配，不随隐藏重排）。 */
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());
  const toggleSeries = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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

  const visible = React.useMemo(
    () => filled.filter((s) => !hidden.has(s.name)),
    [filled, hidden],
  );

  const maxV = React.useMemo(() => {
    const all = visible.flatMap((s) => s.points.map((p) => p.v));
    return all.length ? Math.max(...all) : 0;
  }, [visible]);
  const yMax = niceMax(maxV);

  const yF = (v: number): number => PAD_T + PLOT_H * (1 - v / yMax);
  const baselineY = PAD_T + PLOT_H;

  /** hover：换算 viewBox x；plot 区外 6px 判空；idx 四舍五入对齐槽位。 */
  const [hover, setHover] = React.useState<number | null>(null);
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L - 6 || vx > W - PAD_R + 6) {
      setHover(null);
      return;
    }
    const ratio = (vx - PAD_L) / (W - PAD_L - PAD_R);
    setHover(Math.min(slots - 1, Math.max(0, Math.round(ratio * (slots - 1)))));
  };

  const xTickDays = days.length
    ? days.length <= 7
      ? days
      : [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]]
    : [];

  if (!filled.length) {
    /* 无数据空态（与页面空态同构：图标 + muted 文案） */
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <ChartLine
          className="h-8 w-8 text-muted-foreground/60"
          aria-hidden="true"
        />
        <p>No transaction volume data in the selected window.</p>
      </div>
    );
  }

  const hoverDay = hover != null ? days[hover] : null;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-auto w-full"
          role="img"
          aria-label="Transaction volume trend"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {/* 每序列独立渐变：stop 取 currentColor（继承 linearGradient 的
                text-<palette> color），绕开 tailwind 无 stop-* 工具类 */}
            {filled.map((s, si) => (
              <linearGradient
                key={s.name}
                id={`${uid}-grad-${si}`}
                className={textOf(si)}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {/* y 轴 4 段刻度网格（nice max 等分） */}
          <g className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke">
            {[1, 2, 3, 4].map((i) => (
              <line
                key={`grid-${i}`}
                x1={PAD_L}
                x2={W - PAD_R}
                y1={PAD_T + (PLOT_H * i) / 4}
                y2={PAD_T + (PLOT_H * i) / 4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* 渐变面积 + 平滑曲线（隐藏序列不渲染） */}
          {visible.map((s) => {
            const si = filled.indexOf(s);
            const pts = s.points.map((p) => ({ x: xF(p.idx), y: yF(p.v) }));
            const line = smoothPath(pts);
            const area =
              pts.length > 1
                ? `${line} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`
                : '';
            return (
              <g key={s.name}>
                {area && (
                  <path
                    d={area}
                    fill={`url(#${uid}-grad-${si})`}
                    stroke="none"
                  />
                )}
                <path
                  d={line}
                  fill="none"
                  className={strokeOf(si)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* hover 十字线（垂直参考线；pad 内有效） */}
          {hover != null && (
            <line
              x1={xF(hover)}
              x2={xF(hover)}
              y1={PAD_T}
              y2={baselineY}
              className="stroke-muted-foreground/60"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* y 轴 compact 标签（DOM 绝对定位，避开 preserveAspectRatio 拉伸） */}
        {[4, 3, 2, 1].map((i) => (
          <span
            key={`ylab-${i}`}
            className="pointer-events-none absolute left-0 w-[44px] pr-1 text-right text-[10px] tabular-nums text-muted-foreground"
            style={{ top: `${((PAD_T + (PLOT_H * i) / 4) / H) * 100}%` }}
          >
            {compactLabel((yMax * i) / 4)}
          </span>
        ))}

        {/* hover 气泡（DOM；不拦截指针） */}
        {hoverDay != null && (
          <div
            className="pointer-events-none absolute z-10 w-[136px] rounded-md border border-border/70 bg-popover/95 p-2 text-xs shadow-sm"
            style={{
              left: `${(xF(hover ?? 0) / W) * 100}%`,
              top: PAD_T + 4,
              transform:
                (hover ?? 0) / Math.max(slots - 1, 1) > 0.6
                  ? 'translateX(-148px)'
                  : 'translateX(12px)',
            }}
          >
            <div className="mb-1 font-medium tabular-nums">{hoverDay}</div>
            {visible.map((s) => {
              const si = filled.indexOf(s);
              const p = s.points.find((q) => q.idx === hover);
              return (
                <div
                  key={`tip-${s.name}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={`inline-block size-2 shrink-0 rounded-full bg-current ${textOf(si)}`}
                    />
                    <span className="truncate text-muted-foreground">
                      {s.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {fmt(p?.v ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* x 轴刻度（DOM flex space-between，与 plot 区同 padding） */}
        {xTickDays.length > 0 && (
          <div
            className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground"
            style={{ paddingLeft: PAD_L, paddingRight: PAD_R }}
          >
            {xTickDays.map((d) => (
              <span key={d}>{d.slice(5)}</span>
            ))}
          </div>
        )}

        {/* 全隐藏空态（有数据但图例全关） */}
        {visible.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            All series hidden — click a legend item to restore
          </div>
        )}
      </div>

      {/* 图例：圆点 + 序列名，可点击隐藏/恢复（off 态 line-through + muted） */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {filled.map((s, si) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={`legend-${s.name}`}
              type="button"
              onClick={() => toggleSeries(s.name)}
              className={`flex items-center gap-1.5 text-xs transition-colors hover:text-foreground ${
                off ? 'text-muted-foreground/60 line-through' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`inline-block size-2 rounded-full bg-current ${textOf(si)}`}
              />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
