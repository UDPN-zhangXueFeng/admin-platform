'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import { CopyableEllipsisText } from '@myorg/shared/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useUserAccrualQuery, useUserDistributeQuery, useUserOpRecordQuery, useUserTxQuery,
  type DistributeRecord, type UserOpRecord, type UserTx, type UserWalletRecordFilters,
} from '@myorg/modules/td-admin/data-access';
import type { AccrualRecord } from '@myorg/modules/td-admin/data-access/lib/wallet';
import { ApprovalStatusBadge } from '../approval-manage/approval-status-badge';
import { createRowActionsColumn } from '../row-actions';
import { UserWalletRecordFilter } from './user-wallet-record-filter';
import { UserWalletTable, useWalletTableState } from './user-wallet-table';
import { USER_WALLET_PERMISSIONS, amountWithSymbol, walletTime } from './user-wallet-rules';
import { EMPTY_DISPLAY } from './wallet.constants';

export function UserWalletTransactions({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  const table = useWalletTableState({});
  const query = useUserTxQuery(walletId, table.request);
  const columns: ColumnDef<UserTx>[] = [
    { accessorKey: 'txFrom', header: t('userWallet.column.txFrom'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txFrom} copyLabel={t('userWallet.copy')} /> },
    // The legacy transaction view defines this display policy as End User for every row.
    { id: 'submissionPolicy', header: t('userWallet.column.submissionPolicy'), cell: () => t('userWallet.submissionPolicy.endUser') },
    { accessorKey: 'txTo', header: t('userWallet.column.txTo'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txTo} copyLabel={t('userWallet.copy')} /> },
    { accessorKey: 'blockchainName', header: t('userWallet.column.blockchain') },
    { accessorKey: 'txType', header: t('userWallet.column.txType'), cell: ({ row }) => {
      const key = `tdTransactionType.${row.original.txType}`;
      return t.has(key) ? t(key) : row.original.txType ?? EMPTY_DISPLAY;
    } },
    { accessorKey: 'txAmount', header: t('userWallet.column.txAmount'), cell: ({ row }) => amountWithSymbol(row.original.txAmount, row.original.symbol) },
    { accessorKey: 'txTime', header: t('userWallet.column.txTime'), cell: ({ row }) => walletTime(row.original.txTime) },
    { accessorKey: 'txHash', header: t('userWallet.column.txHash'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txHash} copyLabel={t('userWallet.copy')} /> },
  ];
  return <UserWalletTable title={t('userWallet.tab.transactions')} columns={columns} query={query} page={table.request}
    onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange} />;
}

export function UserWalletOperations({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const { permissions } = useAuth();
  const table = useWalletTableState<UserWalletRecordFilters>({});
  const query = useUserOpRecordQuery(walletId, table.request, table.request.filters);
  const columns: ColumnDef<UserOpRecord>[] = [
    { accessorKey: 'txHash', header: t('userWallet.column.txHash'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txHash} copyLabel={t('userWallet.copy')} /> },
    { accessorKey: 'operateType', header: t('userWallet.column.operateType'), cell: ({ row }) => {
      const key = `operateType.${row.original.operateType}`;
      return t.has(key) ? t(key) : row.original.operateType ?? EMPTY_DISPLAY;
    } },
    { id: 'content', header: t('userWallet.column.content'), cell: ({ row }) => {
      const { operateType, newStatus, oldStatus, operateNum } = row.original;
      switch (operateType) {
        case 1: return t('operateContent.created');
        case 2: return <div>{t('operateContent.frozenNewStatus')}<br />{t('operateContent.frozenOldStatus')}</div>;
        case 3: return <div>{t('operateContent.unfrozenNewStatus')}<br />{t('operateContent.unfrozenOldStatus')}</div>;
        case 5: return <div>{t('operateContent.changeNewStatus')}: {newStatus ?? EMPTY_DISPLAY}<br />{t('operateContent.changeOldStatus')}: {oldStatus ?? EMPTY_DISPLAY}</div>;
        case 6: return `${t('operateContent.freezeFunds')}: ${amountWithSymbol(operateNum)}`;
        case 7: return `${t('operateContent.unfreezeFunds')}: ${amountWithSymbol(operateNum)}`;
        default: return EMPTY_DISPLAY;
      }
    } },
    { accessorKey: 'createUser', header: t('userWallet.column.creator') },
    { accessorKey: 'createTime', header: t('common.createTime'), cell: ({ row }) => walletTime(row.original.createTime) },
    { accessorKey: 'operationStatus', header: t('common.status'), cell: ({ row }) => <ApprovalStatusBadge family="task" status={row.original.operationStatus} /> },
  ];
  if (permissions.has(USER_WALLET_PERMISSIONS.operationDetail)) columns.push(createRowActionsColumn<UserOpRecord>({
    header: t('common.operate'), detail: (row) => row.taskId == null ? undefined : {
      label: t('common.detail'),
      onClick: () => {
        const params = new URLSearchParams({ id: row.taskId ?? '', busCode: row.businessCode ?? '' });
        router.push(`/approval-manage/view?${params}`);
      },
    },
  }));
  return (
    <UserWalletTable title={t('userWallet.tab.operations')} columns={columns} query={query} page={table.request}
      onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange}>
      <UserWalletRecordFilter variant="operations" onApply={(filters) => table.apply(filters, query.refetch)} onReset={() => table.apply({}, query.refetch, true)} />
    </UserWalletTable>
  );
}

export function UserWalletAccrual({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  const table = useWalletTableState<UserWalletRecordFilters>({});
  const query = useUserAccrualQuery(walletId, table.request, table.request.filters);
  const { pageNum, pageSize } = table.request;
  const columns: ColumnDef<AccrualRecord>[] = [
    { id: 'index', header: t('userWallet.column.index'), cell: ({ row }) => (pageNum - 1) * pageSize + row.index + 1 },
    { accessorKey: 'accrualTime', header: t('userWallet.column.accrualTime'), cell: ({ row }) => walletTime(row.original.accrualTime) },
    { accessorKey: 'feeType', header: t('userWallet.column.feeType'), cell: ({ row }) => {
      const key = `userFeeType.${row.original.feeType}`;
      return t.has(key) ? t(key) : row.original.feeType ?? EMPTY_DISPLAY;
    } },
    { accessorKey: 'feePeriod', header: t('userWallet.column.feePeriod'), cell: ({ row }) => walletTime(row.original.feePeriod, true) },
    { accessorKey: 'accrualAmount', header: t('userWallet.column.accrualAmount'), cell: ({ row }) => amountWithSymbol(row.original.accrualAmount, row.original.tokenCurrencySymbol) },
    { accessorKey: 'blockchainName', header: t('userWallet.column.blockchain') },
  ];
  return (
    <UserWalletTable title={t('userWallet.tab.accrual')} columns={columns} query={query} page={table.request}
      onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange}>
      <UserWalletRecordFilter variant="accrual" onApply={(filters) => table.apply(filters, query.refetch)} onReset={() => table.apply({}, query.refetch, true)} />
    </UserWalletTable>
  );
}

export function UserWalletDistribution({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  const table = useWalletTableState<UserWalletRecordFilters>({});
  const query = useUserDistributeQuery(walletId, table.request, table.request.filters);
  const { pageNum, pageSize } = table.request;
  const columns: ColumnDef<DistributeRecord>[] = [
    { id: 'index', header: t('userWallet.column.index'), cell: ({ row }) => (pageNum - 1) * pageSize + row.index + 1 },
    { accessorKey: 'payableOn', header: t('userWallet.column.payableOn'), cell: ({ row }) => walletTime(row.original.payableOn) },
    { accessorKey: 'earningsDate', header: t('userWallet.column.earningsDate'), cell: ({ row }) => walletTime(row.original.earningsDate, true) },
    { accessorKey: 'dividendAmount', header: t('userWallet.column.dividendAmount'), cell: ({ row }) => amountWithSymbol(row.original.dividendAmount, row.original.dividendAmountCurrency, false) },
    { accessorKey: 'dividendUnits', header: t('userWallet.column.dividendUnits'), cell: ({ row }) => amountWithSymbol(row.original.dividendUnits, row.original.dividendUnitsSymbol) },
    { accessorKey: 'txTime', header: t('userWallet.column.txTime'), cell: ({ row }) => walletTime(row.original.txTime) },
    { accessorKey: 'txHash', header: t('userWallet.column.txHash'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txHash} copyLabel={t('userWallet.copy')} /> },
    // This endpoint returns completed distributions; the legacy column renders the completed task status.
    { id: 'status', header: t('common.status'), cell: () => <ApprovalStatusBadge family="task" status={35} /> },
  ];
  return (
    <UserWalletTable title={t('userWallet.tab.distribution')} columns={columns} query={query} page={table.request}
      onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange}>
      <UserWalletRecordFilter variant="distribution" onApply={(filters) => table.apply(filters, query.refetch)} onReset={() => table.apply({}, query.refetch, true)} />
    </UserWalletTable>
  );
}
