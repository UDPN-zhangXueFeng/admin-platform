'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@myorg/shared/ui';
import type {
  EodAccountingStatus,
  EodClearingStatus,
  EodStatementRow,
} from '@myorg/modules/chart-of-accounts/data-access';

/**
 * EOD 列表列定义（迁移自源 useChartOfAccounts eodColumns / firstBookEodColumns）。
 * antd ColumnsType → TanStack ColumnDef；renderStatusTag / renderEodClearingStatusText
 * → 内联 badge / label。
 */
export interface EodColumnsOptions {
  t: (key: string) => string;
  onOpenDetail: (record: EodStatementRow) => void;
  onPostToSuspense?: (record: EodStatementRow) => void;
}

function accountingStatusTag(status: EodAccountingStatus, t: (k: string) => string) {
  const isBalanced = status === 'balanced';
  return (
    <span
      className={
        isBalanced
          ? 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300'
      }
    >
      {isBalanced ? t('eod.balanced') : t('eod.unbalanced')}
    </span>
  );
}

function clearingStatusLabel(status: EodClearingStatus, t: (k: string) => string) {
  switch (status) {
    case 'settled':
      return t('eod.clearingSettled');
    case 'suspensed':
      return t('eod.clearingSuspensed');
    case 'adjusted':
      return t('eod.clearingAdjusted');
    case 'pending':
      return t('eod.clearingPending');
    default:
      return t('eod.clearingNone');
  }
}

function actionLabel(record: EodStatementRow, t: (k: string) => string) {
  switch (record.actionType) {
    case 'post-to-suspense':
      return t('eod.actionPostToSuspense');
    case 'review-confirm':
      return t('eod.actionReview');
    default:
      return t('eod.actionDetails');
  }
}

/** 第二账本 EOD 列表列（8 列）。 */
export function buildEodColumns({ t, onOpenDetail }: EodColumnsOptions): ColumnDef<EodStatementRow>[] {
  return [
    { accessorKey: 'eodDate', header: t('eod.eodDate') },
    { accessorKey: 'totalAssets', header: t('eod.totalAssets') },
    { accessorKey: 'totalLiabilities', header: t('eod.totalLiabilities') },
    { accessorKey: 'suspenseEntries', header: t('eod.suspenseEntries') },
    { accessorKey: 'createdOn', header: t('eod.createdOn') },
    {
      accessorKey: 'accountingStatus',
      header: t('eod.accountingStatus'),
      cell: ({ row }) => accountingStatusTag(row.original.accountingStatus, t),
    },
    {
      accessorKey: 'clearingStatus',
      header: t('eod.clearingStatus'),
      cell: ({ row }) => clearingStatusLabel(row.original.clearingStatus, t),
    },
    {
      id: 'actions',
      header: t('eod.actions'),
      cell: ({ row }) => (
        <Button variant="link" className="h-auto p-0" onClick={() => onOpenDetail(row.original)}>
          {actionLabel(row.original, t)}
        </Button>
      ),
    },
  ];
}

/** 第一账本 EOD 列表列（含 closedBy + post-to-suspense 操作）。 */
export function buildFirstBookEodColumns({
  t,
  onOpenDetail,
  onPostToSuspense,
}: EodColumnsOptions): ColumnDef<EodStatementRow>[] {
  return [
    { accessorKey: 'eodDate', header: t('eod.postingDate') },
    { accessorKey: 'totalAssets', header: t('eod.totalAssets') },
    { accessorKey: 'totalLiabilities', header: t('eod.totalLiabilities') },
    { accessorKey: 'suspenseEntries', header: t('eod.suspenseEntries') },
    { accessorKey: 'createdOn', header: t('eod.createdOn') },
    {
      accessorKey: 'accountingStatus',
      header: t('eod.accountingStatus'),
      cell: ({ row }) => accountingStatusTag(row.original.accountingStatus, t),
    },
    {
      accessorKey: 'clearingStatus',
      header: t('eod.clearingStatus'),
      cell: ({ row }) => clearingStatusLabel(row.original.clearingStatus, t),
    },
    { accessorKey: 'closedBy', header: t('eod.closedBy') },
    {
      id: 'actions',
      header: t('eod.actions'),
      cell: ({ row }) => {
        const record = row.original;
        if (record.actionType === 'post-to-suspense') {
          return (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => onPostToSuspense?.(record)}
            >
              {t('eod.actionPostToSuspense')}
            </Button>
          );
        }
        return (
          <Button variant="link" className="h-auto p-0" onClick={() => onOpenDetail(record)}>
            {actionLabel(record, t)}
          </Button>
        );
      },
    },
  ];
}
