/**
 * Financial 审核组件共享 UI 原语（InfoSection / InfoGrid）+ 安全 i18n helper。
 *
 * 迁移自 td-manage `financial-normalization.tsx` 与 `financial-posting-rule.tsx`
 * 两处重复定义的 InfoSection / InfoGrid（文档 §7 步骤 11 明确要求「抽公共
 * InfoSection/InfoGrid 勿两处各写」）。两组件高度同构，共用此文件避免 Rule 7 冲突。
 *
 * 同时提供 `useFinancialT`：financial 组件消费大量 `financial_*` / `PUB_*` i18n key，
 * 这些 key 在目标 `modules.approval-manage` 命名空间下尚未补全（源跨 financial/common
 * 命名空间）。next-intl 默认对缺失 key 抛错，此处封装为「缺 key 时回退到 key 本身」，
 * 避免运行时 MISSING_MESSAGE 崩溃（文档 §8 运行时坑：渲染原始 key 字符串优于抛错）。
 * 阶段五 i18n 补全后行为自动正确，无需改组件。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { EMPTY_FIELD_VALUE } from '@myorg/modules/approval-manage/util';

/** InfoGrid 单元格（迁移自源 InfoGridCell）。 */
export interface InfoGridCell {
  content: React.ReactNode;
  isLabel?: boolean;
  colSpan?: number;
}

/**
 * 安全翻译函数：缺 key 时返回 key 本身（而非抛错）。
 *
 * next-intl 的 `t()` 在 message 缺失时抛 MISSING_MESSAGE；financial 组件的
 * `financial_*` / `PUB_*` key 当前不在 approval-manage 命名空间，故用此兜底。
 * 返回 `string`（financial 组件只消费纯文本 label/title）。
 */
export function useFinancialT() {
  const t = useTranslations('modules.approval-manage');
  return React.useCallback(
    (key: string): string => {
      try {
        const value = t(key);
        return value;
      } catch {
        // 缺失 key：回退到 key 本身（运行时可见、不崩；阶段五补全词条后自动正确）。
        return key;
      }
    },
    [t]
  );
}

/**
 * 标题区块（迁移自源 InfoSection）。
 *
 * 视觉：mt-8 上间距 + 标题（text-base font-semibold #10264f）+ children。
 * 目标用 Tailwind + CSS 变量（text-foreground / bg-muted）替代源硬编码色，
 * 保持 posting-engine book-detail 同一观感（同 approval-detail-grid 决策）。
 */
export function InfoSection({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * 键值网格（合并 normalization / posting 两处 InfoGrid）。
 *
 * 布局（照源，columns 控制列数）：
 * - columns=1：`[150px_minmax(0,1fr)]`（label | value）单列。
 * - columns=2（默认）：`[150px_minmax(0,1fr)_150px_minmax(0,1fr)]` 两对 label|value。
 * - posting 版源用 flatMap 把 4 格行拆成 2 个 2 格行——此处统一用 columns=2 的 4 格行
 *   渲染（语义等价，posting 调用方传 4 格行），避免两套分行逻辑（Rule 7 取合并版）。
 *
 * 单元格：label 列 bg-muted + font-medium；value 列 bg-background。colSpan 跨列。
 */
export function InfoGrid({
  rows,
  columns = 2,
}: {
  rows: InfoGridCell[][];
  columns?: 1 | 2;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-border text-sm">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid ${
            columns === 1
              ? 'grid-cols-[150px_minmax(0,1fr)]'
              : 'grid-cols-[150px_minmax(0,1fr)_150px_minmax(0,1fr)]'
          } ${
            rowIndex === rows.length - 1 ? '' : 'border-b border-border'
          }`}
        >
          {row.map((item, itemIndex) => (
            <div
              key={`${rowIndex}-${itemIndex}`}
              className={`min-h-[48px] px-3 py-3 ${
                itemIndex === row.length - 1 ? '' : 'border-r border-border'
              } ${
                item.isLabel
                  ? 'bg-muted font-medium text-foreground'
                  : 'bg-background text-foreground'
              }`}
              style={
                item.colSpan
                  ? { gridColumn: `span ${item.colSpan}` }
                  : undefined
              }
            >
              {item.content}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** antd 色名 → Tailwind badge class（与 approval-status-badge 同构，本地自洽）。 */
export function toneClass(tone?: string): string {
  const map: Record<string, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    processing: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    default: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  return (tone && map[tone]) || map.default;
}

/**
 * normalization / posting 共用 task-status badge（迁移自两处 renderStatus）。
 *
 * - status 空/0/非数 → '--'。
 * - tone 走 i18n `approval_task_status_color_${n}`（返回 antd 色名），经 toneClass 转 class。
 * - label 走 `common_task_status_${n}`（已补全）。
 * - posting 特殊态：status===20||35 → label 用 `PUB_Succeed`（源 renderStatus，posting 独有）。
 *   传 `succeedKey` 时启用此覆盖（normalization 不传，保持 common_task_status_）。
 *
 * 经 useFinancialT 的 t 注入（缺 key 回退 key 本身）。
 */
export function FinancialStatusBadge({
  t,
  status,
  succeedKey,
}: {
  t: (key: string) => string;
  status?: number | null;
  /** posting 20/35 覆盖文案的 i18n key（如 'PUB_Succeed'）；normalization 不传。 */
  succeedKey?: string;
}) {
  if (
    status === undefined ||
    status === null ||
    Number(status) === 0 ||
    !Number.isFinite(Number(status))
  ) {
    return <>{EMPTY_FIELD_VALUE}</>;
  }
  const n = Number(status);
  const tone = t(`approval_task_status_color_${n}`);
  const label =
    succeedKey && (n === 20 || n === 35) ? t(succeedKey) : t(`common_task_status_${n}`);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
        tone
      )}`}
    >
      {label}
    </span>
  );
}

/** financial 组件通用的「取首个非空值，否则 '--'」（迁移自源 getValue）。 */
export function pickFirstValue(
  ...values: Array<unknown>
): string {
  const found = values.find(
    (item) => item !== undefined && item !== null && item !== ''
  );
  return found === undefined || found === null
    ? EMPTY_FIELD_VALUE
    : String(found);
}

/** 取首个非空原始值（不强制 string 化，用于时间戳）。迁移自源 getTimestampValue。 */
export function pickFirstRaw(
  ...values: Array<unknown>
): unknown {
  return values.find(
    (item) => item !== undefined && item !== null && item !== ''
  );
}
