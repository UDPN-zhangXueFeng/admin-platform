/**
 * SPRecordsTable — 铸销记录 Tab 分支 3：SP 直铸记录表（源 customTableSp）。
 *
 * 源: tab-records.tsx 303-480（非质押且非 MMF 的兜底分支）。由
 * OverviewRecordsTab 渲染。共享常量/工具见 records-table-helpers.ts。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable } from '@myorg/shared/ui';
import { Button } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  ORDER_TYPE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useSPRecordQuery,
  type SPRecordItem,
} from '@myorg/modules/td-admin/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '..';
import {
  APPROVAL_VIEW_ROUTE,
  DATETIME_FMT,
  buildTxBrowserHref,
  formatAmount,
} from './records-table-helpers';
import type { OverviewRecordsTabProps } from './tab-records';

// ═══════════════════════════════════════════════════════════════════
// 分支 3：SP 直铸记录（customTableSp）
// ═══════════════════════════════════════════════════════════════════

/**
 * SP 直铸记录表（源 customTableSp）。
 *
 * endpoint: POST /api/manage/v1/transaction/getDirectMintingTxList
 * initialValues: stablecoinId（源 getUsablePrice.stablecoinId）。
 * rowKey: orderNumber。
 */
export function SPRecordsTable({ td }: OverviewRecordsTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinId: td?.stablecoinId ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.stablecoinId],
  );

  const query = useSPRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  const handleView = React.useCallback(
    (row: SPRecordItem) => {
      router.push(
        `${APPROVAL_VIEW_ROUTE}?id=${row.taskId ?? ''}&busCode=${
          row.businessCode ?? ''
        }`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<SPRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0160：spName（源 ellipsis）
        accessorKey: 'spName',
        header: t('tokenized_deposit_0160'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.spName} ellipsis />
        ),
      },
      {
        // tokenized_deposit_0161：walletAddress（源 ellipsis）
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0161'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.walletAddress}
            ellipsis
          />
        ),
      },
      {
        // transaction_flow_004：order_type_{txType}
        accessorKey: 'txType',
        header: t('transaction_flow_004'),
        cell: ({ getValue }) => {
          const txType = getValue<number>();
          if (txType == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${ORDER_TYPE_KEY_PREFIX}${txType}`)}</span>;
        },
      },
      {
        // transaction_flow_005：reSet(txAmount) + ' ' + symbol
        accessorKey: 'txAmount',
        header: t('transaction_flow_005'),
        cell: ({ row }) => (
          <span>
            {formatAmount(row.original.txAmount)} {row.original.symbol ?? ''}
          </span>
        ),
      },
      {
        // PUB_CreateTime（源 createTime 出现两次，第二次实际是占位；保留单列）
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_003：txTime
        accessorKey: 'txTime',
        header: t('transaction_flow_003'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_007：txHash → Copy + browser href（源 ellipsis）
        accessorKey: 'txHash',
        header: t('transaction_flow_007'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.txHash}
            href={buildTxBrowserHref(row.original.browserUrl, row.original.txHash)}
            ellipsis
          />
        ),
      },
      {
        // PUB_Status：Badge
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="task"
            status={getValue<number>()}
          />
        ),
      },
      {
        // Serial No.：orderNumber（源无 render）。源为硬编码英文未走 i18n，这里保持纯文本避免 MISSING_MESSAGE
        accessorKey: 'orderNumber',
        header: 'Serial No.',
        cell: ({ row }) => (
          <span>{row.original.orderNumber || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const disabled = row.original.taskId == null;
          return (
            <PermissionGuard permission={TD_PERMISSIONS.VIEW_RECORD}>
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={disabled}
                onClick={() => handleView(row.original)}
              >
                {t('PUB_Detail')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, handleView],
  );

  return (
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
  );
}
