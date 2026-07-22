'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useUserAuthorizationQuery,
  useUserAuthorizedQuery,
  type AuthRecord,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  toMillis,
} from '@myorg/modules/wallet/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const AUTH_TAB = 'authorization';
const AUTHORIZED_TAB = 'authorized';

function formatTs(ts?: number | string | null): string {
  const ms = toMillis(typeof ts === 'string' ? Number(ts) : ts);
  return ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY;
}

/**
 * UserWalletDetailHistoryContent — 用户钱包授权历史 history 变体（2 tab）。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/history.tsx`（299 行）。
 * tab：authorization（授权记录，useUserAuthorizationQuery）+ authorized（已授权记录，
 * useUserAuthorizedQuery）。两表同构（AuthRecord），区别在 endpoint 与默认 tab。
 *
 * status 列沿用源 `common_task_status_${status}` 语义：通过 user-wallet 状态族渲染，
 * 30/35/40 由 i18n commonTaskStatus 补全（badge label）。
 *
 * 由 UserWalletDetailPage 在 slug[1]=`history` 时渲染。
 */
export function UserWalletDetailHistoryContent({
  walletId,
}: {
  walletId: number;
}) {
  const t = useTranslations('modules.wallet');

  const [authPage, setAuthPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const authList = useUserAuthorizationQuery(walletId, authPage);

  const [authorizedPage, setAuthorizedPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const authorizedList = useUserAuthorizedQuery(walletId, authorizedPage);

  const authColumns = React.useMemo<ColumnDef<AuthRecord>[]>(
    () => buildAuthColumns(t),
    [t]
  );
  const authorizedColumns = React.useMemo<ColumnDef<AuthRecord>[]>(
    () => buildAuthColumns(t),
    [t]
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue={AUTH_TAB}>
        <TabsList>
          <TabsTrigger value={AUTH_TAB}>
            {t('userWallet.tab.authorization')}
          </TabsTrigger>
          <TabsTrigger value={AUTHORIZED_TAB}>
            {t('userWallet.tab.authorized')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={AUTH_TAB}>
          <HistoryTableSection
            title={t('userWallet.tab.authorization')}
            columns={authColumns}
            data={authList.data?.rows ?? []}
            isLoading={authList.isLoading || authList.isFetching}
            emptyMessage={t('common.noData')}
            page={authPage}
            total={authList.data?.page?.total ?? 0}
            onPageChange={(p) =>
              setAuthPage((prev) => ({ ...prev, pageNum: p }))
            }
          />
        </TabsContent>

        <TabsContent value={AUTHORIZED_TAB}>
          <HistoryTableSection
            title={t('userWallet.tab.authorized')}
            columns={authorizedColumns}
            data={authorizedList.data?.rows ?? []}
            isLoading={authorizedList.isLoading || authorizedList.isFetching}
            emptyMessage={t('common.noData')}
            page={authorizedPage}
            total={authorizedList.data?.page?.total ?? 0}
            onPageChange={(p) =>
              setAuthorizedPage((prev) => ({ ...prev, pageNum: p }))
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 授权/已授权两表同构列定义（迁移自源 history.tsx 两张表）。 */
function buildAuthColumns(
  t: ReturnType<typeof useTranslations>
): ColumnDef<AuthRecord>[] {
  return [
    {
      accessorKey: 'walletAddress',
      header: t('userWallet.column.walletAddress'),
      cell: ({ row }) => (
        <span className="break-all">
          {row.original.walletAddress || EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      id: 'type',
      header: t('userWallet.column.type'),
      cell: ({ row }) => {
        const key = row.original.type
          ? `changeType.${row.original.type}`
          : undefined;
        return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
      },
    },
    {
      accessorKey: 'blockchainName',
      header: t('userWallet.column.blockchain'),
      cell: ({ row }) => (
        <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
      ),
    },
    {
      id: 'amount',
      header: t('userWallet.column.amount'),
      cell: ({ row }) => (
        <span>
          {row.original.amount != null
            ? `${row.original.amount} ${row.original.symbol ?? ''}`.trim()
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      id: 'operationType',
      header: t('userWallet.column.operateType'),
      cell: ({ row }) => {
        const key = row.original.type
          ? `authorizedOperationType.${row.original.type}`
          : undefined;
        return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
      },
    },
    {
      id: 'operationTime',
      header: t('userWallet.column.operationTime'),
      cell: ({ row }) => <span>{formatTs(row.original.operationTime)}</span>,
    },
    {
      id: 'status',
      header: t('userWallet.column.status'),
      cell: ({ row }) => (
        <WalletStatusBadge family="user-wallet" status={row.original.status} />
      ),
    },
    {
      accessorKey: 'txHash',
      header: t('userWallet.column.txHash'),
      cell: ({ row }) => (
        <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
      ),
    },
  ];
}

/** 授权历史表格区段（标题 + DataTable 服务端分页）。 */
function HistoryTableSection<T extends { id: string }>({
  title,
  columns,
  data,
  isLoading,
  emptyMessage,
  page,
  total,
  onPageChange,
}: {
  title: string;
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  emptyMessage: string;
  page: { pageNum: number; pageSize: number };
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      <div className="p-4">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          pagination={{
            page: page.pageNum,
            pageSize: page.pageSize,
            total,
            onPageChange,
          }}
        />
      </div>
    </section>
  );
}
