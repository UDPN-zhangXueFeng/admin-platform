'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';

import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';

import {
  useSuspenseEntryDetailQuery,
  type SuspenseAdjustmentHistoryItem,
  type SuspenseEntryLine,
} from '@myorg/modules/suspense-adjustment/data-access';
import {
  ADJUSTMENT_STATUS_MAP,
  CLEAR_STATUS_MAP,
  formatAmount,
  textOrDash,
} from '@myorg/modules/suspense-adjustment/util';
import { SuspenseStatusBadge } from '@myorg/modules/suspense-adjustment/ui';

/** 审批业务码（源 view.tsx 常量，history 行无 busCode 时兜底）。 */
const SUSPENSE_ADJUSTMENT_BUS_CODE = 'fin_suspense_adjustment';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/** SuspenseEntryLine 注入 id 满足 DataTable `{ id: string }` 契约。 */
type EntryTableRow = SuspenseEntryLine & { id: string };

/**
 * SuspenseAdjustmentDetailPage — 暂记分录详情页。
 *
 * 迁移自 td-manage src/pages/financial/adjustments/view.tsx（558 行）。
 * 4 区块（非 Tabs，与源一致）：Basic Details（kv）+ Suspense Entries（分录表）+
 * Amount Summary（金额汇总）+ Adjustment History（历史表 + 审批跳转 + Back）。
 *
 * 路由：/suspense-adjustment/view?id=suspenseRecordId（dispatcher slug[0]=view → detail）。
 */
export function SuspenseAdjustmentDetailPage() {
  const t = useTranslations('modules.suspense-adjustment');
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspenseRecordId = parseId(searchParams.get('id'));

  const { data: detail, isLoading } =
    useSuspenseEntryDetailQuery(suspenseRecordId);

  const entryColumns = React.useMemo<ColumnDef<EntryTableRow>[]>(
    () => [
      {
        accessorKey: 'drCr',
        header: t('field.drCr'),
        cell: ({ row }) => <span>{textOrDash(row.original.drCr)}</span>,
      },
      {
        accessorKey: 'accountDisplay',
        header: t('field.account'),
        cell: ({ row }) => <span>{textOrDash(row.original.accountDisplay)}</span>,
      },
      {
        id: 'debit',
        header: t('field.debit'),
        cell: ({ row }) => (
          <span>
            {row.original.debitAmount != null
              ? formatAmount(row.original.debitAmount, '')
              : '--'}
          </span>
        ),
      },
      {
        id: 'credit',
        header: t('field.credit'),
        cell: ({ row }) => (
          <span>
            {row.original.creditAmount != null
              ? formatAmount(row.original.creditAmount, '')
              : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'exceptionContext',
        header: t('field.exceptionContext'),
        cell: ({ row }) => (
          <span>{textOrDash(row.original.exceptionContext)}</span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('field.createdBy'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdBy)}</span>,
      },
      {
        accessorKey: 'createdOn',
        header: t('field.createdOn'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdOn)}</span>,
      },
    ],
    [t],
  );

  const historyColumns = React.useMemo<
    ColumnDef<SuspenseAdjustmentHistoryItem>[]
  >(
    () => [
      {
        accessorKey: 'postingDate',
        header: t('field.postingDate'),
        cell: ({ row }) => <span>{textOrDash(row.original.postingDate)}</span>,
      },
      {
        accessorKey: 'offsetAccountDisplay',
        header: t('field.offsetAccount'),
        cell: ({ row }) => (
          <span>{textOrDash(row.original.offsetAccountDisplay)}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('field.amount'),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.amount, '')}</span>
        ),
      },
      {
        accessorKey: 'adjustmentReason',
        header: t('field.adjustmentReason'),
        cell: ({ row }) => (
          <span>{textOrDash(row.original.adjustmentReason)}</span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('field.createdBy'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdBy)}</span>,
      },
      {
        accessorKey: 'createdOn',
        header: t('field.createdOn'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdOn)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <SuspenseStatusBadge
            tone={ADJUSTMENT_STATUS_MAP[row.original.status]?.color ?? 'default'}
            label={row.original.statusLabel}
          />
        ),
      },
      {
        id: 'action',
        header: t('field.actions'),
        cell: ({ row }) =>
          row.original.canViewDetails ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/approval-manage/view?id=${
                    row.original.taskId ?? row.original.adjustmentId
                  }&busCode=${
                    row.original.busCode ?? SUSPENSE_ADJUSTMENT_BUS_CODE
                  }`,
                )
              }
            >
              {t('action.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
    ],
    [t, router],
  );

  if (!suspenseRecordId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        {isLoading ? '' : t('empty')}
      </div>
    );
  }

  const entryRows: EntryTableRow[] = detail.suspenseEntries.map((e, i) => ({
    ...e,
    id: `${e.accountCode}-${e.drCr}-${i}`,
  }));

  const basicRows: KvRow[] = [
    {
      key: 'suspenseTxnId',
      label: t('field.suspenseTxnId'),
      value: <CopyableEllipsisText value={detail.suspenseTxnId} />,
    },
    {
      key: 'status',
      label: t('field.status'),
      value: (
        <SuspenseStatusBadge
          tone={CLEAR_STATUS_MAP[detail.status]?.color ?? 'default'}
          label={detail.statusLabel}
        />
      ),
    },
    {
      key: 'sourceType',
      label: t('field.sourceType'),
      value: <span>{textOrDash(detail.sourceTypeLabel)}</span>,
    },
    {
      key: 'age',
      label: t('field.age'),
      value: <span>{t('ageDays', { count: detail.age })}</span>,
    },
    {
      key: 'financeBookName',
      label: t('field.financeBookName'),
      value: <span>{textOrDash(detail.financeBookName)}</span>,
    },
    {
      key: 'bookId',
      label: t('field.bookId'),
      value: <CopyableEllipsisText value={textOrDash(detail.bookId)} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Basic Details */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.basicInformation')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              {basicRows.map((row) => (
                <tr key={row.key}>
                  <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                    {row.label}
                  </td>
                  <td className="break-all border px-4 py-3">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suspense Entries */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.suspenseEntries')}
        </div>
        <div className="p-4">
          <DataTable
            columns={entryColumns}
            data={entryRows}
            emptyMessage={t('empty')}
          />
        </div>
      </section>

      {/* Amount Summary */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.amountSummary')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              <tr>
                <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                  {t('field.originalAmount')}
                </td>
                <td className="border px-4 py-3 font-semibold">
                  {formatAmount(detail.originalAmount, detail.currency)}
                </td>
              </tr>
              <tr>
                <td className="border bg-muted/30 px-4 py-3 font-medium">
                  {t('field.totalAdjusted')}
                </td>
                <td className="border px-4 py-3">
                  {formatAmount(detail.totalAdjusted, detail.currency)}
                </td>
              </tr>
              <tr>
                <td className="border bg-muted/30 px-4 py-3 font-medium">
                  {t('field.outstandingAmount')}
                </td>
                <td className="border px-4 py-3 text-red-600">
                  {formatAmount(detail.outstandingAmount, detail.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Adjustment History */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.adjustmentHistory')}
        </div>
        <div className="p-4">
          <DataTable
            columns={historyColumns}
            data={detail.adjustmentHistory}
            emptyMessage={t('empty')}
          />
        </div>
        <div className="flex justify-end p-4">
          <Button variant="outline" onClick={() => router.back()}>
            {t('action.back')}
          </Button>
        </div>
      </section>
    </div>
  );
}
