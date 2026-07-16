/**
 * Pledge Asset Category Pie Chart — 储备资产类别占比饼图（recharts）。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/view-basic.tsx 的 echarts
 * loadEcharts 饼图（line ~114-188）。目标项目无 echarts，改用 recharts（package.json
 * 已装 `recharts ^3.8.1`，本组件是 admin-platform 首次实际使用 recharts）。
 *
 * 数据源（源 view-basic chartData useMemo）：
 *   categorieList → `{ value: proportion || 0, name: assetTypeName || \`Category ${i+1}\` }`
 *   8 色循环：index % colors.length。
 *
 * echarts → recharts 迁移点（第 8 章风险）：
 * - echarts `radius: '60%'` + `center: ['50%','50%']` → recharts `<Pie innerRadius outerRadius>`。
 *   源图为实心饼（非环形），故 innerRadius=0、outerRadius='80%'。
 * - echarts `emphasis.itemStyle.shadowBlur/shadowColor`（hover 阴影）→ recharts
 *   `activeShape`（hover 放大 + 阴影）。用 recharts 导出的 `Sector` 组件构造激活扇区
 *   （recharts 内部正是用它渲染扇区，几何正确，无需手拼 SVG path）。
 * - echarts `tooltip.formatter '{a}<br/>{b}: {c}% ({d}%)'` → recharts `<Tooltip>`
 *   formatter，展示 `name: value%`（源数据 proportion 已是百分比数值）。
 * - echarts resize/dispose 手动监听 → recharts `<ResponsiveContainer>` 自动响应。
 *   **约束**：ResponsiveContainer 需父容器固定高度，否则 0 高度不渲染（运行时坑）。
 *   调用方须给容器固定高（本组件内部已用 `h-[160px]` 固定）。
 */
'use client';

import * as React from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';

/** 源 view-basic chartData 的 8 色预定义数组。 */
const COLORS = [
  '#14B8A6',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#84CC16',
  '#F97316',
];

/** 饼图数据项（recharts Pie data 契约）。 */
export interface AssetCategoryPieDatum {
  /** 占比（proportion，已为百分比数值；兜底 0）。 */
  value: number;
  /** 资产类别名（assetTypeName，兜底 `Category ${i+1}`）。 */
  name: string;
}

export interface PledgeAssetCategoryPieChartProps {
  /**
   * 饼图数据。调用方把 categorieList 映射成 `{ value, name }` 传入。
   * 空数组时渲染占位（不渲染空饼）。
   */
  data: AssetCategoryPieDatum[];
}

/**
 * Tooltip 内容格式化（对齐 echarts `'{b}: {c}% ({d}%)'`）。
 *
 * 源 echarts formatter 输出 `Asset Distribution <br> <name>: <value>% (<percent>%)`，
 * 其中 value 是 proportion、d 是 echarts 重算的占比。recharts 这里 value 即 proportion，
 * 直接展示 `name: value%`，语义与源码一致。
 *
 * recharts v3 把 `active`/`payload` 从 TooltipProps 中 Omit，放到 TooltipContentProps
 * （自定义 content 函数的入参）。payload 是数组，取首项。
 *
 * 入参不显式标注泛型（recharts v3 的 `content` 期望 `ContentType<ValueType, NameType>`，
 * ValueType/NameType 为联合类型，显式 `<number, string>` 会与默认泛型不兼容），
 * 用 TooltipContentProps 收窄到所需字段。
 */
function renderTooltipContent(
  props: TooltipContentProps,
): React.ReactNode {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const name = String(item.name ?? '');
  const value = Number(item.value ?? 0);
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
      <span className="font-medium">{name}</span>: {value}%
    </div>
  );
}

/**
 * activeShape：hover 时扇区放大 + 阴影（替代 echarts emphasis.itemStyle.shadowBlur）。
 *
 * recharts v3 Pie 的 activeShape 接收返回 props 的函数。这里用 recharts 导出的
 * `Sector` 组件渲染激活扇区——recharts 内部渲染普通扇区用的就是 Sector，传入
 * props 时几何自动正确。outerRadius +6 实现 hover 放大，drop-shadow 替代 emphasis shadow。
 */
function renderActiveShape(props: unknown): React.JSX.Element {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props as {
    cx?: number;
    cy?: number;
    innerRadius?: number;
    outerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    fill?: string;
  };
  return (
    <g>
      <Sector
        cx={cx ?? 0}
        cy={cy ?? 0}
        innerRadius={innerRadius ?? 0}
        outerRadius={(outerRadius ?? 0) + 6}
        startAngle={startAngle ?? 0}
        endAngle={endAngle ?? 0}
        fill={fill ?? COLORS[0]}
        stroke="#fff"
        strokeWidth={2}
        style={{
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
        }}
      />
    </g>
  );
}

/**
 * 渲染储备资产类别占比饼图。
 *
 * 用法（view-basic 容器预计算 data）：
 * ```tsx
 * <PledgeAssetCategoryPieChart data={pieData} />
 * ```
 *
 * 容器固定高度约束：ResponsiveContainer 必须有固定高度父容器，本组件根 div
 * 已用 `h-[160px]` 固定，调用方无需再设高度。
 */
export function PledgeAssetCategoryPieChart({
  data,
}: PledgeAssetCategoryPieChartProps): React.JSX.Element {
  // 空数据占位（不渲染空饼，避免 recharts 无 data 时报 warning）
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[160px] w-full items-center justify-center text-xs text-muted-foreground">
        {/* 无资产类别数据 */}
      </div>
    );
  }

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            // 源 echarts radius:'60%' → 实心饼（innerRadius=0）。
            innerRadius={0}
            outerRadius="80%"
            paddingAngle={1}
            isAnimationActive={false}
            // echarts emphasis shadow → recharts activeShape（hover 放大 + 轻阴影）
            activeShape={renderActiveShape}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${entry.name}-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={renderTooltipContent} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
