/**
 * AdminWalletModal「Details / History」态主体 — 钱包详情静态展示 + 详情/历史表。
 *
 * 源: admin-wallet-modal.tsx 141-215（DATETIME_FMT + useWalletDetailColumns）、
 * 514-586（DetailsOrHistoryBody）。仅在 ctx.type 为 Details/History 时由
 * AdminWalletModal 渲染。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useWalletDetailListQuery,
  useWalletHistoryListQuery,
  type WalletDetailItem,
} from '@myorg/modules/td-admin/data-access';
import type { AdminWalletCtx } from './admin-wallet-modal';

/** 详情/历史表时间戳格式。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 详情/历史表列定义（源 959-1091，逐列）。 */
function useWalletDetailColumns(
  withStatus: boolean,
  onView: (row: WalletDetailItem) => void,
): ColumnDef<WalletDetailItem>[] {
  const t = useTranslations('modules.tokenized-deposit');
  return React.useMemo(
    () => [
      {
        // tokenized_deposit_0081：originalWalletAddress
        accessorKey: 'originalWalletAddress',
        header: t('tokenized_deposit_0081'),
        cell: ({ row }) => (
          <span>{row.original.originalWalletAddress || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0053：walletAddress
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0053'),
        cell: ({ row }) => (
          <span>{row.original.walletAddress || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0075：type → admin_wallet_type_${type}
        accessorKey: 'type',
        header: t('tokenized_deposit_0075'),
        cell: ({ row }) => {
          const type = row.original.type;
          return <span>{type == null ? '' : t(`admin_wallet_type_${type}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0057：createTime → formatDate
        accessorKey: 'createTime',
        header: t('tokenized_deposit_0057'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        // tokenized_deposit_0056：createUser
        accessorKey: 'createUser',
        header: t('tokenized_deposit_0056'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      ...(withStatus
        ? [
            {
              // PUB_Status：status → common_task_status_${status}
              id: 'status',
              accessorKey: 'status' as keyof WalletDetailItem,
              header: t('PUB_Status'),
              cell: ({ row }: { row: { original: WalletDetailItem } }) => {
                const status = row.original.status;
                return (
                  <span>
                    {status == null ? '' : t(`common_task_status_${status}`)}
                  </span>
                );
              },
            } as ColumnDef<WalletDetailItem>,
          ]
        : []),
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => (
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_WALLET}>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => onView(row.original)}
            >
              {t('PUB_Detail')}
            </Button>
          </PermissionGuard>
        ),
      },
    ],
    [onView, t, withStatus],
  );
}

/** Details 静态展示 + 详情表 / History 表。 */
export function DetailsOrHistoryBody({
  ctx,
}: {
  ctx: AdminWalletCtx;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  const handleView = React.useCallback(
    (row: WalletDetailItem) => {
      const businessCode = ctx.type === 'History' ? row.busCode : row.businessCode;
      router.push(
        `/approval-manage/view?id=${row.taskId ?? ''}&busCode=${businessCode ?? ''}`,
      );
    },
    [ctx.type, router],
  );
  // 分页（源 initialValues accountType/stablecoinId + useCustomTable 默认分页）。
  const [pageNum, setPageNum] = React.useState(1);
  const params = React.useMemo(
    () => ({
      pageNum,
      pageSize: DEFAULT_PAGE_SIZE,
      accountType: ctx.accountType,
      stablecoinId:
        ctx.stablecoinId != null ? Number(ctx.stablecoinId) : undefined,
    }),
    [pageNum, ctx.accountType, ctx.stablecoinId],
  );

  const detailQuery = useWalletDetailListQuery(params);
  const historyQuery = useWalletHistoryListQuery(params);

  if (ctx.type === 'Details') {
    const detailCols = useWalletDetailColumns(true, handleView);
    const detailRows = (detailQuery.data?.rows ?? []) as WalletDetailItem[];
    const total = detailQuery.data?.page?.total ?? 0;
    return (
      <div className="px-2 py-2">
        <div className="mb-4 flex flex-col">
          <span>{t('tokenized_deposit_0075')}</span>
          <span>{ctx.walletType ?? '--'}</span>
        </div>
        <div className="mb-8 flex flex-col">
          <span>{t('tokenized_deposit_0053')}</span>
          <span>{ctx.walletAddress ?? '--'}</span>
        </div>
        <DataTable
          columns={detailCols}
          data={detailRows}
          isLoading={detailQuery.isLoading}
          pagination={{
            page: pageNum,
            pageSize: DEFAULT_PAGE_SIZE,
            total,
            onPageChange: setPageNum,
          }}
        />
      </div>
    );
  }

  // History
  const historyCols = useWalletDetailColumns(false, handleView);
  const historyRows = (historyQuery.data?.rows ?? []) as WalletDetailItem[];
  const historyTotal = historyQuery.data?.page?.total ?? 0;
  return (
    <div className="px-2 py-2">
      <DataTable
        columns={historyCols}
        data={historyRows}
        isLoading={historyQuery.isLoading}
        pagination={{
          page: pageNum,
          pageSize: DEFAULT_PAGE_SIZE,
          total: historyTotal,
          onPageChange: setPageNum,
        }}
      />
    </div>
  );
}
