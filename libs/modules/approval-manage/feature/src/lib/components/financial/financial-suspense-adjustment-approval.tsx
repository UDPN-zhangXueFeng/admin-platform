/**
 * FinancialSuspenseAdjustmentApproval — 暂记调整审批详情（迁移自 td-manage
 * `src/pages/approval-manage/components/financial-suspense-adjustment.tsx`，270 行）。
 *
 * 业务语义：审批「暂记调整（Suspense Adjustment）」请求，展示 Adjustment Amount +
 * Status + Created by/on + Basic Details（Suspense Txn ID/Source Type/Age/Transaction Type/
 * Financial Book/Original/Outstanding Amount）+ Adjustment Entry 表 + Adjustment Summary
 * （This Adjustment/Remaining After This/Adjustment Reason）。
 *
 * ⚠️ **唯一调 API 组件**：源调 `fetchSuspenseAdjustmentDetail(adjustmentId)` 取
 * `AdjustedDetailDomain`（后端返回 label 化字段 statusLabel/sourceTypeLabel/
 * transactionTypeLabel 等），无 adjustmentId 时回退用 detailInfo 渲染。
 *
 * **迁移限制（Rule 12 标注）**：
 * 目标 approval-manage detail-page 的 dispatcher 把 `businessContent` 透传为 detailInfo，
 * 但源组件消费的 `AdjustedDetailDomain` 是经 suspense-adjustment data-access 适配器加工后的
 * Domain（label 已本地化、字段名归一化）。businessContent 与该 Domain 字段名/语义并不一致
 * （例：Domain 有 statusLabel/sourceTypeLabel，businessContent 多为原始 status/sourceType 数字）。
 *
 * 为避免 approval-manage feature 跨模块依赖 suspense-adjustment data-access（耦合）
 * 且字段语义不可靠，本组件**不调 API，用 detailInfo 兜底渲染**（照任务 T11 指令），
 * 缺失字段显示 '--'（EMPTY_FIELD_VALUE）。状态 badge 走 statusLabel===Approved→green
 * 否则 orange（源 renderStatus 语义）。
 *
 * 后续若需完整字段（amount 计算/entry 表/summary），应：
 * 1. 在 approval-manage data-access 加 fetchSuspenseAdjustmentDetail 封装，或
 * 2. 引入 suspense-adjustment data-access 的 useSuspenseAdjustmentDetailQuery（跨模块依赖）。
 * 当前为最小可用只读展示（detailInfo 直渲），标记为已知限制。
 *
 * 复用 `financial-info-primitives` 的 InfoSection/InfoGrid（2 列布局，同 posting）。
 * i18n 经 useFinancialT 缺 key 回退 key 本身（不崩）。
 */
'use client';

import * as React from 'react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import { EMPTY_FIELD_VALUE } from '@myorg/modules/approval-manage/util';

import {
  toneClass,
  InfoGrid,
  InfoSection,
  useFinancialT,
} from './financial-info-primitives';

/** suspense-adjustment 组件 props。源仅收 detailInfo；目标 dispatcher 透传全集，其余忽略。 */
export interface FinancialSuspenseAdjustmentApprovalProps {
  detailInfo?: Record<string, unknown>;
  approvalInfo?: Record<string, unknown>;
  taskInfo?: Record<string, unknown>;
  approvalStatus?: number;
  busCode?: string;
}

/** Adjustment Entry 表行（迁移自源 detail.adjustmentEntries[]）。 */
interface AdjustmentEntryRow {
  key: string;
  postingDate: string;
  drCr: string;
  account: string;
  amount: string;
}

/**
 * 金额格式化（迁移自源 adjustments/helpers formatAmount）。
 *
 * 源 formatAmount 做：空值→'--'，否则千分位 + 小数 + 货币符号后缀。目标无共享 helper，
 * 此处内联最小实现（Intl.NumberFormat 千分位 + currency 后缀），避免跨模块依赖。
 * currency 缺失时仅格式化数字。
 */
function formatAmount(value?: number | string | null, currency?: string): string {
  if (value === undefined || value === null || value === '') {
    return EMPTY_FIELD_VALUE;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return EMPTY_FIELD_VALUE;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

/** 取值兜底（迁移自源 textOrDash）。 */
function textOrDash(value: unknown): string {
  if (value === undefined || value === null || value === '') return EMPTY_FIELD_VALUE;
  return String(value);
}

/**
 * Status badge（迁移自源 renderStatus）。
 *
 * approvalTaskStatus label===Approved→green，否则 orange（源 Tag color 三元）。
 * statusLabel 为后端已本地化的文本（Approved/Pending/...），目标 detailInfo 可能含
 * statusLabel 字段；缺失则 '--'。
 */
function StatusBadge({
  t,
  label,
}: {
  t: (key: string) => string;
  label: string;
}) {
  if (label === EMPTY_FIELD_VALUE) return <>{EMPTY_FIELD_VALUE}</>;
  // label===Approved→green（源语义），其余 orange。tone key 复用 primitives toneClass。
  const tone = label === 'Approved' ? 'green' : 'orange';
  void t; // useFinancialT 注入（未来 i18n key 化时复用，当前 label 已本地化）
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

export function FinancialSuspenseAdjustmentApproval({
  detailInfo,
}: FinancialSuspenseAdjustmentApprovalProps) {
  const t = useFinancialT();
  const detail = (detailInfo ?? {}) as Record<string, unknown>;

  const currency = (detail.currency as string) || '';
  const statusLabel = textOrDash(detail.statusLabel);
  const thisAdjustment = formatAmount(
    detail.thisAdjustment as number | string | null | undefined,
    currency
  );
  const outstandingAmount = formatAmount(
    detail.outstandingAmount as number | string | null | undefined,
    currency
  );
  const remainingAfterThis = formatAmount(
    detail.remainingAfterThis as number | string | null | undefined,
    currency
  );
  const originalAmount = formatAmount(
    detail.originalAmount as number | string | null | undefined,
    currency
  );
  const bookNo = textOrDash(detail.bookNo || detail.bookId);

  const entries = React.useMemo<AdjustmentEntryRow[]>(
    () =>
      (Array.isArray(detail.adjustmentEntries) ? detail.adjustmentEntries : []).map(
        (itemRaw, index) => {
          const item = (itemRaw ?? {}) as Record<string, unknown>;
          return {
            key: String(index),
            postingDate: textOrDash(item.postingDate),
            drCr: textOrDash(item.drCr),
            account: textOrDash(item.accountDisplay ?? item.account),
            amount: formatAmount(
              item.amount as number | string | null | undefined,
              currency
            ),
          };
        }
      ),
    [detail.adjustmentEntries, currency]
  );

  return (
    <div className="rounded border bg-card p-5 pb-6">
      <div className="mb-6 border-b pb-4 text-base font-semibold text-foreground">
        Adjustment Request Details
      </div>

      <InfoSection title="Request Information">
        <InfoGrid
          columns={2}
          rows={[
            [
              { content: 'Adjustment Amount', isLabel: true },
              { content: thisAdjustment },
              { content: 'Status', isLabel: true },
              { content: <StatusBadge t={t} label={statusLabel} /> },
            ],
            [
              { content: 'Created by', isLabel: true },
              { content: textOrDash(detail.createdBy) },
              { content: 'Created on', isLabel: true },
              { content: textOrDash(detail.createdOn) },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title="Basic Details">
        <InfoGrid
          columns={2}
          rows={[
            [
              { content: 'Suspense Txn ID', isLabel: true },
              { content: textOrDash(detail.suspenseTxnId) },
              { content: 'Source Type', isLabel: true },
              { content: textOrDash(detail.sourceTypeLabel) },
            ],
            [
              { content: 'Age', isLabel: true },
              { content: `${detail.age ?? 0} Day(s)` },
              { content: 'Transaction Type', isLabel: true },
              { content: textOrDash(detail.transactionTypeLabel) },
            ],
            [
              { content: 'Financial Book Name', isLabel: true },
              { content: textOrDash(detail.financeBookName) },
              { content: 'Book ID', isLabel: true },
              {
                content: (
                  <CopyableEllipsisText value={bookNo} className="!mb-0" />
                ),
              },
            ],
            [
              { content: 'Original Amount', isLabel: true },
              { content: originalAmount },
              { content: 'Outstanding Amount', isLabel: true },
              {
                content: (
                  <span className="text-destructive">{outstandingAmount}</span>
                ),
              },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title="Adjustment Entry">
        <div className="mb-2 text-sm">
          Offsetting Entry for:{' '}
          <span className="font-semibold">
            {textOrDash(detail.offsettingEntryFor)}
          </span>
        </div>
        <AdjustmentEntryTable rows={entries} />
      </InfoSection>

      <InfoSection title="Adjustment Summary">
        <InfoGrid
          columns={1}
          rows={[
            [
              { content: 'This Adjustment', isLabel: true },
              { content: thisAdjustment },
            ],
            [
              { content: 'Remaining After This', isLabel: true },
              {
                content: (
                  <span className="text-primary">{remainingAfterThis}</span>
                ),
              },
            ],
            [
              { content: 'Adjustment Reason', isLabel: true },
              { content: textOrDash(detail.adjustmentReason) },
            ],
          ]}
        />
      </InfoSection>
    </div>
  );
}

/** Adjustment Entry 表（迁移自源 SimpleTable，4 列）。 */
function AdjustmentEntryTable({ rows }: { rows: AdjustmentEntryRow[] }) {
  if (!rows.length) {
    return (
      <table className="w-full table-fixed border-collapse text-sm">
        <tbody>
          <tr>
            <td
              colSpan={4}
              className="border border-border px-3 py-3 text-muted-foreground"
            >
              {EMPTY_FIELD_VALUE}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-[25%]" />
        <col className="w-[15%]" />
        <col className="w-[35%]" />
        <col className="w-[25%]" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Posting Date
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Dr/Cr
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Account
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="border border-border px-2 py-3 break-words">
              {row.postingDate}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.drCr}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.account}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.amount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
