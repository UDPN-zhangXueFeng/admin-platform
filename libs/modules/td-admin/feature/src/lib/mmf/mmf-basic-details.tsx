/**
 * MMF Basic Details — 详情页基本信息描述列表。
 *
 * 替代源的 `CustomIBasicDetailsInfo`（antd `Descriptions`，column=3、bordered）。
 * 渲染一个 Card 包裹的 key-value 网格，支持每项 grid span：
 *   - 默认 span=2（与源 Descriptions.Item 默认 span:2 一致，3 列网格中占 2 列）
 *   - 详情页状态字段 span=3 打破 2 列网格（占满整行）
 *
 * 设计与 statements-detail-content 的 basicRows + <table> 视觉对齐：
 *   - Card 容器 + 标题栏（border-b）
 *   - label 单元格 muted 背景 / value 单元格白底
 *   - 加载中显示空行，空数据显示 empty 文案
 *
 * 不耦合具体业务字段：调用方（accrual-detail / settlement-detail）构造 items
 * 并注入已格式化的 ReactNode（金额拼接 reSet、时间 formatTimestamp、状态 Badge 等）。
 */
import * as React from 'react';

/** 网格总列数（与源 Descriptions column=3 一致）。 */
const GRID_COLUMNS = 3;

export interface MmfBasicDetailItem {
  /** 唯一 key（React key）。 */
  key: string;
  /** 标签文案（已 i18n）。 */
  label: React.ReactNode;
  /** 值内容（调用方负责格式化 / 拼接 tokenSymbol / 渲染 Badge）。 */
  value: React.ReactNode;
  /**
   * 该项横跨的网格列数（1..3），默认 2（与源 span:2 一致）。
   * 状态字段传 3 以占满整行、打破默认 2 列布局。
   */
  span?: number;
}

export interface MmfBasicDetailsProps {
  /** 标题（已 i18n）。 */
  title?: React.ReactNode;
  /** 描述项列表。 */
  items: MmfBasicDetailItem[];
  /** 是否加载中（加载中渲染空骨架行）。 */
  isLoading?: boolean;
  /** 无数据占位文案。 */
  emptyMessage?: React.ReactNode;
  /** 额外 className（追加到 Card 根节点）。 */
  className?: string;
}

function clampSpan(span: number | undefined): number {
  if (span == null) return 2;
  if (!Number.isFinite(span)) return 2;
  const n = Math.floor(span);
  if (n < 1) return 1;
  if (n > GRID_COLUMNS) return GRID_COLUMNS;
  return n;
}

/**
 * 渲染基本信息描述列表。
 *
 * 网格采用 3 列等分。每项按 span 占列，内部固定拆为 1 列 label + (span-1) 列 value，
 * 复刻源 bordered `Descriptions`（label 窄列 / value 填充剩余）观感：
 *   - span=2（默认）：label 占 1 列、value 占 1 列，成对排列。
 *   - span=3（状态字段）：占满整行，label 1 列 + value 2 列，打破默认 2 列布局。
 */
export function MmfBasicDetails({
  title,
  items,
  isLoading = false,
  emptyMessage = '--',
  className,
}: MmfBasicDetailsProps) {
  const showEmpty = !isLoading && items.length === 0;

  return (
    <section
      className={`rounded-lg border bg-card shadow-sm ${className ?? ''}`}
    >
      {title ? (
        <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      ) : null}
      <div className="overflow-x-auto">
        {showEmpty ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div
            className="grid text-sm"
            style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}
          >
            {isLoading
              ? Array.from({ length: GRID_COLUMNS }, (_, i) => (
                  <DetailCells
                    key={`skeleton-${i}`}
                    label={<span>&nbsp;</span>}
                    value={<span>&nbsp;</span>}
                    span={2}
                  />
                ))
              : items.map((item) => (
                  <DetailCells
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    span={clampSpan(item.span)}
                  />
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface DetailCellsProps {
  label: React.ReactNode;
  value: React.ReactNode;
  span: number;
}

/**
 * 单个描述项的两个网格单元（label + value）。
 *
 * label 恒占 1 列，value 占 span-1 列（span>=2 时 value ≥1 列）。
 * 两个 div 都是父网格的直接 item（无中间包裹），保证 border 在网格内正确拼接。
 */
function DetailCells({ label, value, span }: DetailCellsProps) {
  const valueSpan = Math.max(1, span - 1);
  return (
    <>
      <div
        className="border bg-muted/30 px-4 py-3 font-medium"
        style={{ gridColumn: 'span 1' }}
      >
        {label}
      </div>
      <div
        className="break-all border px-4 py-3"
        style={{ gridColumn: `span ${valueSpan}` }}
      >
        {value}
      </div>
    </>
  );
}
