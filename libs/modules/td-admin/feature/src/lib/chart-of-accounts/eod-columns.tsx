'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@myorg/shared/ui';
import { createRowActionsColumn } from '../row-actions';
import type {
  EodAccountingStatus,
  EodClearingStatus,
  EodStatementRow,
} from '@myorg/modules/td-admin/data-access';

/**
 * EOD 列表列定义（迁移自源 useChartOfAccounts eodColumns / firstBookEodColumns）。
 * antd ColumnsType → TanStack ColumnDef；renderStatusTag / renderEodClearingStatusText
 * → 内联 badge / label。
 */
export interface EodColumnsOptions {
  t: (key: string) => string;
  onOpenDetail: (record: EodStatementRow) => void;
}

function accountingStatusTag(status: EodAccountingStatus, t: (k: string) => string) {
  const isBalanced = status === 'balanced';
  return (
    <Badge variant={isBalanced ? 'success' : 'destructive'} dot>
      {isBalanced ? t('eod.balanced') : t('eod.unbalanced')}
    </Badge>
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
  return record.clearingStatus === 'pending' ? t('eod.actionReview') : t('eod.actionDetails');
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
    // 行内主操作（Details / Review）；无需菜单。
    createRowActionsColumn<EodStatementRow>({
      header: t('field.actions'),
      detail: (row) => ({
        label: actionLabel(row, t),
        onClick: () => onOpenDetail(row),
      }),
    }),
  ];
}

/** 第一账本 EOD 列表列（含 closedBy + post-to-suspense 操作）。 */
export function buildFirstBookEodColumns({
  t,
  onOpenDetail,
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
    createRowActionsColumn<EodStatementRow>({
      header: t('field.actions'),
      detail: (row) => row.actionType === 'post-to-suspense'
        ? { label: t('eod.actionPostToSuspense'), disabled: true, onClick: onOpenDetail }
        : { label: actionLabel(row, t), onClick: onOpenDetail },
    }),
  ];
}
