'use client';

/**
 * 按日交易笔数柱状图（Dashboard P1 原型对齐）。
 *
 * 行为源 LPP 原型 `client/src/pages/DashboardPage.jsx` 的 DailyBarChart：
 * flex 柱按窗口最大值归一化（非零 ≥4%、零值 2% 下限），按高度比分档加深、
 * 峰值最深；悬停回显走共享 Tooltip（禁原生 title）；x 轴隔 N 根短日期标签；
 * sr-only 数据清单承载读屏（门禁 §1.3.7）。UI 用本仓体系重实现（t-* 排版
 * 角色 + 语义色 token），不引图表库。
 */
import { BarChart3 } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@myorg/shared/ui';

/** 单日点：day 为 GMT+8 日切 'YYYY-MM-DD'（与 /dashboard/volume 口径一致）；count 为当日全状态交易笔数。 */
export interface VolumePoint {
  day: string;
  count: number;
}

/** GMT+8 日字符串 → 英文短日期（'Sep 23'；UTC 解析避免偏移，非法原样返回）。 */
export function shortDayLabel(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** 柱底色：零值灰、峰值最深、按高度比分档加深（原型 barTone 语义 → primary 透明度阶梯）。 */
function barTone(count: number, max: number): string {
  if (count <= 0) return 'bg-muted-foreground/25';
  if (count === max) return 'bg-primary';
  const ratio = count / max;
  if (ratio >= 0.75) return 'bg-primary/80';
  if (ratio >= 0.5) return 'bg-primary/60';
  if (ratio >= 0.25) return 'bg-primary/40';
  return 'bg-primary/25';
}

/** 按日笔数柱状图（points 为空时由调用方自行给空态，本组件不渲染）。 */
export function VolumeBarChart({ points }: { points: VolumePoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  /** x 轴最多 8 个标签：窗口越长隔得越稀（原型 labelEvery 同构）。 */
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <div
        role="img"
        aria-label={points
          .map((point) => `${shortDayLabel(point.day)}: ${point.count}`)
          .join(', ')}
        className="flex h-[220px] items-end gap-1 border-b sm:h-[240px]"
      >
        {points.map((point) => {
          const ratio = point.count / max;
          const percent = Math.max(ratio * 100, point.count > 0 ? 4 : 2);
          return (
            <Tooltip key={point.day}>
              <TooltipTrigger asChild>
                <div className="group flex h-full min-w-0 flex-1 cursor-help flex-col justify-end">
                  <div
                    className={`w-full rounded-t transition-colors ${barTone(
                      point.count,
                      max,
                    )}${point.count > 0 ? ' group-hover:bg-primary' : ''}`}
                    style={{ height: `${percent}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="tabular-nums">
                {`${shortDayLabel(point.day)}: ${point.count}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {points.map((point, index) => (
          <span
            key={point.day}
            className="t-supporting min-w-0 flex-1 truncate text-center text-muted-foreground"
          >
            {index % labelEvery === 0 ? shortDayLabel(point.day) : ''}
          </span>
        ))}
      </div>
      <div className="sr-only">
        <ul>
          {points.map((point) => (
            <li key={point.day}>{`${shortDayLabel(point.day)}: ${point.count}`}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 图表空态：虚线框 + 图标 + 文案（原型 ChartEmptyState 同构）。 */
export function VolumeChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center sm:h-[240px]">
      <BarChart3
        className="h-[22px] w-[22px] text-muted-foreground"
        aria-hidden="true"
      />
      <p className="t-body text-muted-foreground">{message}</p>
    </div>
  );
}
