/**
 * PledgeRecordsTable — 铸销记录 Tab 分支 1：质押铸造记录表（源 customTable）。
 *
 * 源: tab-records.tsx 132-301。mintMethod===1 && pledgeType===1 时由
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
  RECORD_TYPE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useTDRecordQuery,
  type TDRecordItem,
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
// 分支 1：质押铸造记录（customTable）
// ═══════════════════════════════════════════════════════════════════

/**
 * 质押铸造铸销记录表（源 customTable）。
 *
 * endpoint: POST /api/manage/v1/td/manage/searches/record
 * initialValues: stablecoinCode（源 getUsablePrice.code）。
 * rowKey: recordId。
 */
export function PledgeRecordsTable({ td }: OverviewRecordsTabProps): React.JSX.Element {
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
      stablecoinCode: td?.code ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.code],
  );

  const query = useTDRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  const handleView = React.useCallback(
    (row: TDRecordItem) => {
      router.push(
        `${APPROVAL_VIEW_ROUTE}?id=${row.taskId ?? ''}&busCode=${
          row.businessCode ?? ''
        }`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<TDRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0135：recordType===1 取 to，否则取 from（源 dataIndex 'from' + render）
        accessorKey: 'from',
        header: t('tokenized_deposit_0135'),
        cell: ({ row }) => {
          const r = row.original;
          const val = r.recordType === 1 ? r.to : r.from;
          return <span>{val || EMPTY_DISPLAY}</span>;
        },
      },
      {
        // tokenized_deposit_0087：stablecoin_record_type_{recordType}
        accessorKey: 'recordType',
        header: t('tokenized_deposit_0087'),
        cell: ({ getValue }) => {
          const recordType = getValue<number>();
          if (recordType == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${RECORD_TYPE_KEY_PREFIX}${recordType}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0088：reSet(amount) + ' ' + symbol
        accessorKey: 'amount',
        header: t('tokenized_deposit_0088'),
        cell: ({ row }) => (
          <span>
            {formatAmount(row.original.amount)} {row.original.symbol ?? ''}
          </span>
        ),
      },
      {
        // PUB_Creater
        accessorKey: 'createUser',
        header: t('PUB_Creater'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_CreateTime：formatTimestamp(Number(createTime))
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
        // tokenized_deposit_0089：transactionHash → Copy + browser href
        accessorKey: 'transactionHash',
        header: t('tokenized_deposit_0089'),
        cell: ({ row }) => {
          const hash = row.original.transactionHash;
          if (!hash) return <span>{EMPTY_DISPLAY}</span>;
          return (
            <TokenizedDepositCopy
              text={hash}
              href={buildTxBrowserHref(row.original.browserUrl, hash)}
              ellipsis
            />
          );
        },
      },
      {
        // tokenized_deposit_0086：transactionTime
        accessorKey: 'transactionTime',
        header: t('tokenized_deposit_0086'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：approval_task_status_color_ + common_task_status_
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
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => (
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_RECORD}>
            {/* 源 disabled: false（质押分支恒可点） */}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => handleView(row.original)}
            >
              {t('PUB_Detail')}
            </Button>
          </PermissionGuard>
        ),
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
