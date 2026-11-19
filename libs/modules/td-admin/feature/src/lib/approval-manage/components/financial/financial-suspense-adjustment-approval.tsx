/**
 * FinancialSuspenseAdjustmentApproval — suspense adjustment approval detail.
 * Migrated from td-manage
 * `src/pages/approval-manage/components/financial-suspense-adjustment.tsx`.
 *
 * The source component is the only approval component that calls an API: it
 * resolves `adjustmentId` from `detailInfo` (`adjustmentId ?? id`), loads
 * `/finance/suspense-adjustment/detail` and renders the adapted
 * `AdjustedDetailDomain`. Without an id — or when the API returns no data — it
 * falls back to the raw `businessContent` passed by the dispatcher.
 *
 * Field mapping mirrors the source: statusLabel / sourceTypeLabel /
 * transactionTypeLabel / thisAdjustment / remainingAfterThis / amounts / book
 * fields / createdBy / createdOn / adjustmentEntries. Labels are already
 * localized by the data-access adapter, so no extra formatting is needed.
 *
 * Reuses `financial-info-primitives` InfoSection/InfoGrid (same 2-column layout
 * as the posting-rule approval). i18n goes through useFinancialT and falls back
 * to the key itself when a translation is missing.
 */
'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  useSuspenseAdjustmentDetailQuery,
  type AdjustedDetailDomain,
} from '@myorg/modules/td-admin/data-access/lib/suspense-adjustment';
import { EMPTY_FIELD_VALUE } from '../..';

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
 * Resolve the adjustment id from `businessContent` (source `getAdjustmentId`).
 * Returns undefined for empty / non-numeric ids so the query stays disabled.
 */
function resolveAdjustmentId(
  detailInfo?: Record<string, unknown>,
): number | undefined {
  const raw = detailInfo?.adjustmentId ?? detailInfo?.id;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

/**
 * Map the adapted `AdjustedDetailDomain` to the flat render shape consumed by
 * this component. The source reads exactly these field names off the fetched
 * detail, so keeping them here avoids leaking domain-only fields into render.
 */
function mapAdjustedDetail(
  domain: AdjustedDetailDomain,
): Record<string, unknown> {
  return {
    statusLabel: domain.statusLabel,
    thisAdjustment: domain.thisAdjustment,
    originalAmount: domain.originalAmount,
    outstandingAmount: domain.outstandingAmount,
    remainingAfterThis: domain.remainingAfterThis,
    currency: domain.currency,
    bookId: domain.bookId,
    bookNo: domain.bookNo,
    financeBookName: domain.financeBookName,
    suspenseTxnId: domain.suspenseTxnId,
    sourceTypeLabel: domain.sourceTypeLabel,
    transactionTypeLabel: domain.transactionTypeLabel,
    age: domain.age,
    offsettingEntryFor: domain.offsettingEntryFor,
    adjustmentReason: domain.adjustmentReason,
    createdBy: domain.createdBy,
    createdOn: domain.createdOn,
    adjustmentEntries: (domain.adjustmentEntries ?? []).map((entry) => ({
      postingDate: entry.postingDate,
      drCr: entry.drCr,
      accountDisplay: entry.accountDisplay,
      amount: entry.amount,
    })),
  };
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
  const fallbackDetail = (detailInfo ?? {}) as Record<string, unknown>;
  const adjustmentId = resolveAdjustmentId(fallbackDetail);
  const detailQuery = useSuspenseAdjustmentDetailQuery(adjustmentId);
  const adjustedDetail = detailQuery.data;

  // API result wins; raw businessContent is the source fallback (same as source).
  const detail = React.useMemo<Record<string, unknown>>(
    () =>
      adjustedDetail
        ? mapAdjustedDetail(adjustedDetail)
        : fallbackDetail,
    [adjustedDetail, fallbackDetail],
  );

  const currency = (detail.currency as string) || '';
  const statusLabel = textOrDash(detail.statusLabel);
  const thisAdjustment = formatAmount(
    (detail.thisAdjustment as number | string | null | undefined) ?? 0,
    currency
  );
  const outstandingAmount = formatAmount(
    (detail.outstandingAmount as number | string | null | undefined) ?? 0,
    currency
  );
  const remainingAfterThis = formatAmount(
    (detail.remainingAfterThis as number | string | null | undefined) ?? 0,
    currency
  );
  const originalAmount = formatAmount(
    (detail.originalAmount as number | string | null | undefined) ?? 0,
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
              (item.amount as number | string | null | undefined) ?? 0,
              currency
            ),
          };
        }
      ),
    [detail.adjustmentEntries, currency]
  );

  if (adjustmentId && detailQuery.isLoading && !adjustedDetail) {
    return (
      <div className="flex items-center gap-2 rounded border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading adjustment details...
      </div>
    );
  }

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
