/**
 * 钱包表内部组件 WalletsTableInner（listPage / balance 双 URL 共用列定义，
 * 仅 query hook 不同）。
 * 源: tab-wallets.tsx 89-90、203-443
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatAdminTimestamp } from '../../format-admin-time';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useWalletBalanceQuery,
  useWalletQuery,
  type WalletItem,
} from '@myorg/modules/td-admin/data-access';
import { TokenizedDepositCopy } from '..';
import type { OverviewWalletsTabProps } from './tab-wallets';


// ═══════════════════════════════════════════════════════════════════
// 钱包表（双 URL 共用列定义，仅 query hook 不同）
// ═══════════════════════════════════════════════════════════════════

interface WalletsTableInnerProps extends OverviewWalletsTabProps {
  /** 当前走哪个 endpoint（isOnclick 对应）。 */
  variant: 'listPage' | 'balance';
  /** 刷新按钮旋转动画标志。 */
  doRe: boolean;
  /** 刷新回调（由父层传入，内部对接 balance query refetch）。 */
  onRefresh: (refetchBalance: () => void) => void;
}

/**
 * 钱包表内部组件（listPage / balance 共用，按 variant 选 query hook）。
 *
 * endpoint：
 * - listPage → POST /api/manage/v1/td/wallet/listPage
 * - balance → POST /api/manage/v1/td/wallet/balance
 * rowKey: accountId。
 */
export function WalletsTableInner({
  td,
  variant,
  doRe,
  onRefresh,
  onOpenAdminWalletModal,
}: WalletsTableInnerProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // stablecoinCode 注入（源 initialValues.stablecoinCode = getUsablePrice.code）。
  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinCode: td?.code ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.code],
  );

  // 双 URL：variant 决定走哪个 hook（query key 不同，缓存不污染）。
  const listQuery = useWalletQuery(params);
  const balanceQuery = useWalletBalanceQuery(params);
  const query = variant === 'balance' ? balanceQuery : listQuery;

  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // 行操作 Edit（源 actionClick 'Edit' → type 'Update'）。
  const handleEdit = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'Update', row });
    },
    [onOpenAdminWalletModal],
  );
  // 行操作 View（源 actionClick 'View' → type t('PUB_Detail') → 语义 'Details'）。
  const handleView = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'Details', row });
    },
    [onOpenAdminWalletModal],
  );
  // 行操作 History（源 actionClick 'History' → type t('tokenized_deposit_0077') → 语义 'History'）。
  const handleHistory = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'History', row });
    },
    [onOpenAdminWalletModal],
  );

  const columns = React.useMemo<ColumnDef<WalletItem>[]>(
    () => [
      {
        // tokenized_deposit_0176：admin_wallet_type_{type}（纯文案）
        accessorKey: 'type',
        header: t('tokenized_deposit_0176'),
        cell: ({ getValue }) => {
          const type = getValue<number>();
          if (type == null) return <span>{EMPTY_DISPLAY}</span>;
          // 源 t(`admin_wallet_type_${type}`)，常量前缀 ADMIN_WALLET_TYPE_KEY_PREFIX。
          // 直接拼 key（与 tab-records recordType 列同模式），避免再 import 前缀常量。
          return <span>{t(`admin_wallet_type_${type}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0049：blockchainName（源无 render）
        accessorKey: 'blockchainName',
        header: t('tokenized_deposit_0049'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0053：walletAddress
        // 源无 render（纯文本），地址超长 → 统一 Copy + ellipsis（与 SP 表一致）。
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0053'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.walletAddress}
            ellipsis
          />
        ),
      },
      {
        // tokenized_deposit_0051：balance → '∞' 或 balance + ' ' + unit
        // 源 render: balance === '∞' ? balance : balance + ' ' + data.unit
        accessorKey: 'balance',
        header: t('tokenized_deposit_0051'),
        cell: ({ row }) => {
          const balance = row.original.balance;
          const unit = row.original.unit ?? '';
          if (balance == null || balance === '') {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return (
            <span>
              {balance === '∞' ? balance : `${balance} ${unit}`}
            </span>
          );
        },
      },
      {
        // tokenized_deposit_0052：updateTime → formatAdminTimestamp
        accessorKey: 'updateTime',
        header: t('tokenized_deposit_0052'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const r = row.original;
          // Edit disabled（源 760）：!(approvalStatus === 0 && operateStatus === 35)
          const editDisabled = !(
            r.approvalStatus === 0 && r.operateStatus === 35
          );
          return (
            <div className="flex items-center gap-3">
              <PermissionGuard permission={TD_PERMISSIONS.EDIT_WALLET}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={editDisabled}
                  onClick={() => handleEdit(r)}
                >
                  {t('tokenized_deposit_0122')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={TD_PERMISSIONS.VIEW_WALLET}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => handleView(r)}
                >
                  {t('PUB_Detail')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={TD_PERMISSIONS.HISTORY}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => handleHistory(r)}
                >
                  {t('Router_0003_19')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, handleEdit, handleView, handleHistory],
  );

  // 刷新按钮（对齐源 727-746 CustomTableTitle 内的刷新 span）。
  // 仅在 balance 态可触发（listPage 态点击会切到 balance 并 refetch）。
  const refreshButton = React.useMemo(
    () => (
      <div className="flex items-center">
        <span>{t('tokenized_deposit_0054')}</span>
        <button
          type="button"
          aria-label="refresh"
          onClick={() => onRefresh(() => balanceQuery.refetch())}
          className={`ml-2 inline-flex h-4 w-4 cursor-pointer items-center justify-center text-muted-foreground transition-transform hover:text-foreground ${
            doRe ? 'animate-spin' : ''
          }`}
        >
          {/* Refresh icon (heroicons arrow-path) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>
    ),
    [t, onRefresh, doRe, balanceQuery],
  );

  return (
    <div className="space-y-3">
      {/* 标题区（对齐源 CustomTableTitle，含刷新按钮，源 727-746） */}
      {refreshButton}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
        pagination={{
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total,
          onPageChange: (p) =>
            setPagination((prev) => ({ ...prev, pageNum: p })),
        }}
      />
    </div>
  );
}
