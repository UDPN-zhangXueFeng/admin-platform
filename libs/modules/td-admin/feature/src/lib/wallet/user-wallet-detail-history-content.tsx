'use client';

import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { CopyableEllipsisText, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { useUserAuthorizationQuery, useUserAuthorizedQuery, type AuthRecord, type UserWalletRecordFilters } from '@myorg/modules/td-admin/data-access';
import { ApprovalStatusBadge } from '../approval-manage/approval-status-badge';
import { UserWalletRecordFilter } from './user-wallet-record-filter';
import { UserWalletTable, useWalletTableState } from './user-wallet-table';
import { amountWithSymbol, walletTime } from './user-wallet-rules';
import { EMPTY_DISPLAY } from './wallet.constants';

const historyTabs = ['authorization', 'authorized'] as const;

export function UserWalletDetailHistoryContent({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  return (
    <Tabs defaultValue="authorization">
      <TabsList>{historyTabs.map((tab) => <TabsTrigger key={tab} value={tab}>{t(`userWallet.tab.${tab}`)}</TabsTrigger>)}</TabsList>
      {historyTabs.map((tab) => (
        <TabsContent key={tab} value={tab}>
          <HistoryTable walletId={walletId} variant={tab} useRecords={tab === 'authorization' ? useUserAuthorizationQuery : useUserAuthorizedQuery} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function HistoryTable({ walletId, variant, useRecords }: {
  walletId: number;
  variant: typeof historyTabs[number];
  useRecords: typeof useUserAuthorizationQuery;
}) {
  const t = useTranslations('modules.wallet');
  const table = useWalletTableState<UserWalletRecordFilters>({});
  const query = useRecords(walletId, table.request, table.request.filters);
  const columns: ColumnDef<AuthRecord>[] = [
    { accessorKey: 'walletAddress', header: t(`userWallet.column.${variant === 'authorization' ? 'toWallet' : 'fromWallet'}`),
      cell: ({ row }) => <CopyableEllipsisText value={row.original.walletAddress} copyLabel={t('userWallet.copy')} /> },
    { accessorKey: 'type', header: t('userWallet.column.type'), cell: ({ row }) => {
      const key = `changeType.${row.original.type}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'blockchainName', header: t('userWallet.column.blockchain') },
    { accessorKey: 'amount', header: t('userWallet.column.authorizedAmount'), cell: ({ row }) => amountWithSymbol(row.original.amount, row.original.symbol) },
    { id: 'operationType', header: t('userWallet.column.operateType'), cell: ({ row }) => {
      const key = `authorizedOperationType.${row.original.type}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'operationTime', header: t('userWallet.column.operationTime'), cell: ({ row }) => walletTime(row.original.operationTime) },
    { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <ApprovalStatusBadge family="task" status={row.original.status} /> },
    { accessorKey: 'txHash', header: t('userWallet.column.txHash'), cell: ({ row }) => <CopyableEllipsisText value={row.original.txHash} copyLabel={t('userWallet.copy')} /> },
  ];
  return (
    <UserWalletTable title={t(`userWallet.tab.${variant}`)} columns={columns} query={query} page={table.request}
      onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange}>
      <UserWalletRecordFilter variant={variant} onApply={(filters) => table.apply(filters, query.refetch)} onReset={() => table.apply({}, query.refetch, true)} />
    </UserWalletTable>
  );
}
