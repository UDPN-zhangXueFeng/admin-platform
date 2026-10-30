/**
 * RoleWallets 列表列定义。
 * 源: role-wallets.tsx 31, 113-211
 */
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, CopyableEllipsisText } from '@myorg/shared/ui';
import { formatAdminTimestamp } from '../format-admin-time';
import { TokenizedDepositStatusBadge } from './tokenized-deposit-status-badge';
import {
  EMPTY_DISPLAY,
  type RoleWalletItem,
} from '@myorg/modules/td-admin/data-access';

/**
 * 列表列定义（源 RoleWallets 内 columns useMemo 原样搬移，
 * 参数名与源闭包变量一致：t / translateWalletAttribute / openDetails；
 * onConfigure 对应源 Configure 按钮（仅 Unconfigured 行，源 unshift 在 Details 前））。
 */
export function roleWalletColumns(
  t: ReturnType<typeof useTranslations>,
  translateWalletAttribute: (attribute?: string) => string,
  openDetails: (row: RoleWalletItem) => void,
  onConfigure: (row: RoleWalletItem) => void,
): ColumnDef<RoleWalletItem>[] {
  return [
    {
      accessorKey: 'roleName',
      header: t('role_name'),
      cell: ({ row }) => (
        <span>{row.original.roleName || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'walletAddress',
      header: t('wallet_address'),
      cell: ({ row }) => (
        <CopyableEllipsisText
          value={row.original.walletAddress}
          maxWidth={180}
        />
      ),
    },
    {
      accessorKey: 'blockchain',
      header: t('tokenized_deposit_0007'),
      cell: ({ row }) => (
        <span>{row.original.blockchain || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'walletAttribute',
      header: t('wallet_attribute'),
      cell: ({ row }) => (
        <span>{translateWalletAttribute(row.original.walletAttribute)}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: t('tokenized_deposit_0050'),
      cell: ({ row }) => (
        <span
          className="block max-w-[300px] truncate"
          title={row.original.description ?? ''}
        >
          {row.original.description || EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('PUB_Status'),
      cell: ({ row }) => (
        <TokenizedDepositStatusBadge
          dimension="roleWallet"
          status={row.original.status}
        />
      ),
    },
    {
      accessorKey: 'createdTime',
      header: t('PUB_CreatedTime'),
      cell: ({ row }) => (
        <span>
          {row.original.createdTime
            ? formatAdminTimestamp(Number(row.original.createdTime))
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'updatedTime',
      header: t('tokenized_deposit_0052'),
      cell: ({ row }) => (
        <span>
          {row.original.updatedTime
            ? formatAdminTimestamp(Number(row.original.updatedTime))
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('PUB_Action'),
      cell: ({ row }) => {
        const r = row.original;
        return (
        <div className="flex flex-wrap items-center gap-2">
          {/* 源 unshift Configure：仅 Unconfigured 行，排在 Details 前。 */}
          {r.status === 'Unconfigured' ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => onConfigure(r)}
            >
              {t('configure_wallet')}
            </Button>
          ) : null}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => openDetails(r)}
          >
            {t('wallet_details')}
          </Button>
        </div>
        );
      },
    },
  ];
}
