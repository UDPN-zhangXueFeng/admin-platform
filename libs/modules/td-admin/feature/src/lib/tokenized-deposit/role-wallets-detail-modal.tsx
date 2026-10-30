/**
 * RoleWallets 钱包详情 Modal + 操作历史 Table 列定义。
 * 源: role-wallets.tsx 292-388, 393-457
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@myorg/shared/ui';
import { TokenizedDepositStatusBadge } from './tokenized-deposit-status-badge';
import {
  EMPTY_DISPLAY,
  type RoleWalletItem,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';

interface RoleWalletDetailModalProps {
  open: boolean;
  selectedWallet: RoleWalletItem | null;
  walletOperations: NonNullable<RoleWalletItem['operations']>;
  translateWalletAttribute: (attribute?: string) => string;
  onOpenChange: (open: boolean) => void;
}

export function RoleWalletDetailModal({
  open,
  selectedWallet,
  walletOperations,
  translateWalletAttribute,
  onOpenChange,
}: RoleWalletDetailModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t('wallet_details_title')}</DialogTitle>
      </DialogHeader>
      {selectedWallet ? (
        <div className="space-y-6 py-2">
          {/* 钱包信息 */}
          <div>
            <h3 className="mb-3 text-base font-semibold">
              {t('tokenized_deposit_0115')}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">{t('role_name')}:</span>{' '}
                {selectedWallet.roleName || EMPTY_DISPLAY}
              </div>
              <div>
                <span className="font-medium">{t('PUB_Status')}:</span>{' '}
                <TokenizedDepositStatusBadge
                  dimension="roleWallet"
                  status={selectedWallet.status}
                />
              </div>
              <div className="col-span-2 break-all">
                <span className="font-medium">
                  {t('wallet_address')}:
                </span>{' '}
                {selectedWallet.walletAddress || EMPTY_DISPLAY}
              </div>
              <div>
                <span className="font-medium">
                  {t('tokenized_deposit_0007')}:
                </span>{' '}
                {selectedWallet.blockchain || EMPTY_DISPLAY}
              </div>
              <div>
                <span className="font-medium">
                  {t('wallet_attribute')}:
                </span>{' '}
                {translateWalletAttribute(selectedWallet.walletAttribute)}
              </div>
              <div className="col-span-2">
                <span className="font-medium">
                  {t('tokenized_deposit_0050')}:
                </span>{' '}
                {selectedWallet.description || EMPTY_DISPLAY}
              </div>
              <div>
                <span className="font-medium">
                  {t('PUB_CreatedTime')}:
                </span>{' '}
                {selectedWallet.createdTime
                  ? formatAdminTimestamp(Number(selectedWallet.createdTime))
                  : EMPTY_DISPLAY}
              </div>
              <div>
                <span className="font-medium">
                  {t('tokenized_deposit_0052')}:
                </span>{' '}
                {selectedWallet.updatedTime
                  ? formatAdminTimestamp(Number(selectedWallet.updatedTime))
                  : EMPTY_DISPLAY}
              </div>
            </div>
          </div>

          {/* 操作历史 */}
          <div>
            <h3 className="mb-3 text-base font-semibold">
              {t('operation_history')}
            </h3>
            <DataTable
              columns={operationHistoryColumns(t)}
              data={walletOperations}
              emptyMessage={t('empty')}
            />
          </div>
        </div>
      ) : null}
    </DialogContent>
    </Dialog>
  );
}

// ── 操作历史 Table 列 ──

/**
 * 操作历史列定义（详情 Modal 内嵌 Table）。
 * 源码 6 列：operationType(operation_文案) / description / txHash / operator / timestamp / status。
 */
function operationHistoryColumns(
  t: ReturnType<typeof useTranslations>,
): ColumnDef<NonNullable<RoleWalletItem['operations']>[number]>[] {
  return [
    {
      accessorKey: 'operationType',
      header: t('operation_type'),
      cell: ({ row }) => {
        const type = row.original.operationType;
        if (!type) return <span>{EMPTY_DISPLAY}</span>;
        return <span>{t(`operation_${type.toLowerCase()}`)}</span>;
      },
    },
    {
      accessorKey: 'description',
      header: t('tokenized_deposit_0050'),
      cell: ({ row }) => (
        <span>{row.original.description || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'txHash',
      header: t('operation_tx_hash'),
      cell: ({ row }) => (
        <span
          className="block max-w-[220px] truncate"
          title={row.original.txHash ?? ''}
        >
          {row.original.txHash || EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'operator',
      header: t('operation_operator'),
      cell: ({ row }) => (
        <span>{row.original.operator || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'timestamp',
      header: t('operation_time'),
      cell: ({ row }) => (
        <span>
          {row.original.timestamp
            ? formatAdminTimestamp(Number(row.original.timestamp))
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('PUB_Status'),
      cell: ({ row }) => (
        <span>{row.original.status || EMPTY_DISPLAY}</span>
      ),
    },
  ];
}
