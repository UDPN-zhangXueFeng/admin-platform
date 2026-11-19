'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import type { ColumnDef } from '@tanstack/react-table';
import { useUserWalletListQuery, type UserWallet, type UserWalletFilters } from '@myorg/modules/td-admin/data-access';
import { createRowActionsColumn } from '../row-actions';
import { UserWalletActionDialog } from './user-wallet-action-dialog';
import { UserWalletListFilters } from './user-wallet-list-filters';
import { UserWalletTable, useWalletTableState } from './user-wallet-table';
import { USER_WALLET_PERMISSIONS, amountWithSymbol, walletActionRules, walletFilterNumber, walletTime, type UserWalletAction } from './user-wallet-rules';
import { ALL_VALUE, EMPTY_DISPLAY, custodyModelMessageKey, kycMessageKey } from './wallet.constants';
import { WalletStatusBadge } from './wallet-status-badge';

export function UserWalletListPage() {
  const token = useSearchParams().get('stablecoinId') || ALL_VALUE;
  return <UserWalletList key={token} token={token} />;
}

function UserWalletList({ token }: { token: string }) {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const { permissions } = useAuth();
  const table = useWalletTableState<UserWalletFilters>({ stablecoinId: walletFilterNumber(token) });
  const query = useUserWalletListQuery(table.request);
  const [operation, setOperation] = useState<{ action: UserWalletAction; row: UserWallet }>();
  const actions = Object.keys(walletActionRules) as UserWalletAction[];
  const columns: ColumnDef<UserWallet>[] = [
    { accessorKey: 'walletAddress', header: t('userWallet.column.walletAddress') },
    { accessorKey: 'blockchainName', header: t('userWallet.column.blockchain') },
    { accessorKey: 'spName', header: t('userWallet.column.sp') },
    { accessorKey: 'custodyModel', header: t('userWallet.column.custodyModel'), cell: ({ row }) => {
      const key = custodyModelMessageKey(row.original.custodyModel);
      return key ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'kycRequired', header: t('userWallet.column.kycRequired'), cell: ({ row }) => {
      const key = kycMessageKey(row.original.kycRequired);
      return key ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'tdName', header: t('userWallet.column.tokenName') },
    { accessorKey: 'tokenType', header: t('userWallet.column.tokenType'), cell: ({ row }) => {
      const value = row.original.tokenType;
      const key = `tokenType.${value}`;
      return t.has(key) ? t(key) : value ?? EMPTY_DISPLAY;
    } },
    { accessorKey: 'walletType', header: t('userWallet.column.walletType') },
    { accessorKey: 'stablecoinCount', header: t('userWallet.column.totalBalance'), cell: ({ row }) => amountWithSymbol(row.original.stablecoinCount, row.original.symbol) },
    { accessorKey: 'state', header: t('common.status'), cell: ({ row }) => <WalletStatusBadge family="user-wallet" status={row.original.state} /> },
    { accessorKey: 'createTime', header: t('common.createTime'), cell: ({ row }) => walletTime(row.original.createTime) },
    createRowActionsColumn<UserWallet>({
      header: t('common.operate'),
      detail: permissions.has(USER_WALLET_PERMISSIONS.detail) ? {
        label: t('userWallet.action.detail'),
        onClick: (row) => router.push(`/wallet/user-wallet/view?walletId=${row.walletId}`),
      } : undefined,
      menu: (row) => {
        const items = actions.flatMap((action) => permissions.has(USER_WALLET_PERMISSIONS[action]) && row.walletId ? [{
          label: t(`userWallet.action.${action}`),
          onClick: () => setOperation({ action, row }),
          disabled: !walletActionRules[action](row),
        }] : []);
        if (permissions.has(USER_WALLET_PERMISSIONS.history) && row.walletId) {
          items.push({
            label: t('userWallet.action.history'),
            onClick: () => router.push(`/wallet/user-wallet/history?walletId=${row.walletId}`),
            disabled: row.state === 0 || row.state === 3,
          });
        }
        return items;
      },
    }),
  ];

  return (
    <>
      <UserWalletTable title={t('userWallet.records')} columns={columns} query={query} page={table.request}
        onPageChange={table.onPageChange} onPageSizeChange={table.onPageSizeChange}>
        <UserWalletListFilters stablecoinId={token} onApply={(filters) => table.apply(filters, query.refetch)} onReset={() => {
          table.apply({}, query.refetch, true);
          if (token !== ALL_VALUE) router.replace('/wallet/user-wallet');
        }} />
      </UserWalletTable>
      {operation && <UserWalletActionDialog {...operation} onClose={() => setOperation(undefined)} />}
    </>
  );
}
