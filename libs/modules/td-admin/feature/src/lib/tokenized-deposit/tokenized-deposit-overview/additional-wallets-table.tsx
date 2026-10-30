/**
 * Additional Wallets 静态 mock 表（9 行角色钱包）+ 行数据构造。
 * 源: tab-wallets.tsx 445-648
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable } from '@myorg/shared/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/td-admin/data-access';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import { TokenizedDepositStatusBadge } from '..';
import { formatAdminTimestamp } from '../../format-admin-time';

// ═══════════════════════════════════════════════════════════════════
// Additional Wallets 静态 mock 表（9 行角色钱包）
// ═══════════════════════════════════════════════════════════════════

/** Additional Wallets 行数据（源 1458-1567 静态 mock，无 API）。 */
interface AdditionalWalletRow {
  /** DataTable 契约 id（= key）。 */
  id: string;
  key: string;
  roleName: string;
  walletAddress: string;
  blockchain: string;
  description: string;
  updatedTime: number | null;
  status: 'Unconfigured' | 'Processing' | 'Active';
}

/**
 * Additional Wallets 静态 mock 表（对齐源 1451-1635）。
 *
 * 9 行角色钱包（Force Transfer 第 10 行源注释，不迁移）。
 * blockchain 取当前 TD blockchainName，fallback 'Hyperledger Besu'。
 * status 恒 'Unconfigured'，Badge dimension="roleWallet"。
 */
export function AdditionalWalletsTable({
  td,
}: {
  td: ApplyListItem;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const rows = React.useMemo<AdditionalWalletRow[]>(
    () =>
      buildAdditionalWalletRows(td?.blockchainName).map((row) => ({
        ...row,
        id: row.key,
      })),
    [td?.blockchainName],
  );

  const columns = React.useMemo<ColumnDef<AdditionalWalletRow>[]>(
    () => [
      {
        // role_name（源 dataIndex 'roleName'，width 180）
        accessorKey: 'roleName',
        header: t('role_name'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // wallet_address（源 dataIndex 'walletAddress'，恒 '--'）
        accessorKey: 'walletAddress',
        header: t('wallet_address'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // Chain Name（源直接传 'Chain Name' 给 t()，无 i18n key → 回落显示 key 本身）
        accessorKey: 'blockchain',
        header: 'Chain Name',
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0050：description（源 ellipsis）
        accessorKey: 'description',
        header: t('tokenized_deposit_0050'),
        cell: ({ getValue }) => (
          <span className="line-clamp-1">{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0052：updatedTime → formatAdminTimestamp，null → '--'
        accessorKey: 'updatedTime',
        header: t('tokenized_deposit_0052'),
        cell: ({ getValue }) => {
          const val = getValue<number | null>();
          return (
            <span>
              {val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        // PUB_Status：status → Badge roleWallet
        // 源 Tag color 映射 Unconfigured→default / Processing→processing / Active→success，
        // 文案 role_wallet_status_{lowercase}。TokenizedDepositStatusBadge roleWallet 维度等价。
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="roleWallet"
            status={getValue<AdditionalWalletRow['status']>()}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Additional Wallets</h3>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={t('empty')}
        pagination={{
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          total: rows.length,
          onPageChange: () => {
            /* 源 pageSize: 10，静态数据无需翻页回调 */
          },
        }}
      />
    </div>
  );
}

/**
 * 构造 Additional Wallets 9 行 mock 数据（对齐源 1458-1567）。
 *
 * Force Transfer 第 10 行源注释（1556-1566），不迁移。
 * blockchain fallback 'Hyperledger Besu'（源 getUsablePrice?.blockchainName || 'Hyperledger Besu'）。
 */
function buildAdditionalWalletRows(
  blockchainName?: string,
): Omit<AdditionalWalletRow, 'id'>[] {
  const blockchain = blockchainName || 'Hyperledger Besu';
  const base = {
    walletAddress: '--',
    blockchain,
    updatedTime: null,
    status: 'Unconfigured' as const,
  };
  return [
    {
      key: '1',
      roleName: 'Wallet Configurator',
      description: 'Configures wallet types and attributes.',
      ...base,
    },
    {
      key: '2',
      roleName: 'Service Provider',
      description:
        'Authorized account for SP operations, designated during SP registration.',
      ...base,
    },
    {
      key: '3',
      roleName: 'Register Controller',
      description:
        'Manages SP and wallet registration, wallet limits, and whitelist.',
      ...base,
    },
    {
      key: '4',
      roleName: 'Cold Burner',
      description:
        'Handles burn operations exceeding the threshold using cold wallet.',
      ...base,
    },
    {
      key: '5',
      roleName: 'Hot Burner',
      description:
        'Handles burn operations within the threshold using hot wallet.',
      ...base,
    },
    {
      key: '6',
      roleName: 'Cold Minter',
      description:
        'Handles mint operations exceeding the threshold using cold wallet.',
      ...base,
    },
    {
      key: '7',
      roleName: 'Hot Minter',
      description:
        'Handles mint operations within the threshold using hot wallet.',
      ...base,
    },
    {
      key: '8',
      roleName: 'Freeze Controller',
      description: 'Freezes/unfreezes wallets and wallet funds.',
      ...base,
    },
    {
      key: '9',
      roleName: 'Pause Controller',
      description: 'Pauses/unpauses contract operations.',
      ...base,
    },
    // Force Transfer（源 1556-1566 注释）— 不迁移。
  ];
}
