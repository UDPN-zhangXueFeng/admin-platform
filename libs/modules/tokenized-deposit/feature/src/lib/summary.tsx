'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useMMFSummaryQuery,
  type MMFSummaryItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FUND_TYPE_MAP,
  RISK_LEVEL_MAP,
} from '@myorg/modules/tokenized-deposit/util';

const DATE_FMT = 'YYYY-MM-DD';
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * Summary — MMF 基金汇总表组件。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/summary.tsx（150 行）。
 * useCustomTable → react-hook-form(隐式) + DataTable。
 *
 * 10 列：
 *  1. walletTypeName     (tokenized_deposit_0147)
 *  2. walletTypeCode     (tokenized_deposit_0148)
 *  3. fundType           (tokenized_deposit_0149) → FUND_TYPE_MAP[fundType] || EMPTY_DISPLAY
 *  4. riskLevel          (tokenized_deposit_0150) → RISK_LEVEL_MAP[riskLevel] || EMPTY_DISPLAY
 *  5. fundAssetValue     (tokenized_deposit_0151) → `${value} ${record.totalFundAmountSymbol}` || EMPTY_DISPLAY
 *  6. fundInceptionTime  (tokenized_deposit_0152) → formatDate(time, DATE_FMT) || EMPTY_DISPLAY
 *  7. totalTokenCount    (tokenized_deposit_0153) → `${value} ${record.totalTokenCountSymbol}` || EMPTY_DISPLAY
 *  8. totalFundAmount    (tokenized_deposit_0154) → `${value} ${record.totalFundAmountSymbol}` || EMPTY_DISPLAY
 *  9. walletCount        (tokenized_deposit_0155)
 * 10. fundLastPayoutTime (tokenized_deposit_0157) → formatDate(time, DATETIME_FMT) || EMPTY_DISPLAY
 *
 * 被 td-15 overview Tab1 MMF 分支引用。
 */
interface SummaryProps {
  /** Token 编码，传入 MMFSummaryListParams.tokenCode。 */
  tokenCode: string;
}

export function Summary({ tokenCode }: SummaryProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      tokenCode,
    }),
    [pagination.pageNum, pagination.pageSize, tokenCode],
  );

  const query = useMMFSummaryQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // 副标题：当前 UTC+08:00 时间
  const subtitleDate = React.useMemo(() => {
    const now = new Date();
    const iso = now.toISOString(); // "2026-07-13T08:30:00.000Z"
    const datePart = iso.split('T')[0];
    const timePart = now.toTimeString().split(' ')[0]; // HH:MM:SS (local)
    return `${datePart} ${timePart} UTC+08:00`;
  }, []);

  const columns = React.useMemo<ColumnDef<MMFSummaryItem>[]>(
    () => [
      {
        accessorKey: 'walletTypeName',
        header: t('tokenized_deposit_0147'),
        cell: ({ getValue }) => (
          <span>{String(getValue() ?? EMPTY_DISPLAY)}</span>
        ),
      },
      {
        accessorKey: 'walletTypeCode',
        header: t('tokenized_deposit_0148'),
        cell: ({ getValue }) => (
          <span>{String(getValue() ?? EMPTY_DISPLAY)}</span>
        ),
      },
      {
        accessorKey: 'fundType',
        header: t('tokenized_deposit_0149'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          if (val == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{FUND_TYPE_MAP[val] ?? EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'riskLevel',
        header: t('tokenized_deposit_0150'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          if (val == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{RISK_LEVEL_MAP[val] ?? EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'fundAssetValue',
        header: t('tokenized_deposit_0151'),
        cell: ({ row }) => {
          const value = row.original.fundAssetValue;
          return (
            <span>
              {value != null
                ? `${value} ${row.original.totalFundAmountSymbol ?? ''}`
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'fundInceptionTime',
        header: t('tokenized_deposit_0152'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>
              {val ? formatDate(val, DATE_FMT) : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'totalTokenCount',
        header: t('tokenized_deposit_0153'),
        cell: ({ row }) => {
          const value = row.original.totalTokenCount;
          return (
            <span>
              {value != null
                ? `${value} ${row.original.totalTokenCountSymbol ?? ''}`
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'totalFundAmount',
        header: t('tokenized_deposit_0154'),
        cell: ({ row }) => {
          const value = row.original.totalFundAmount;
          return (
            <span>
              {value != null
                ? `${value} ${row.original.totalFundAmountSymbol ?? ''}`
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'walletCount',
        header: t('tokenized_deposit_0155'),
        cell: ({ getValue }) => (
          <span>{String(getValue() ?? EMPTY_DISPLAY)}</span>
        ),
      },
      {
        accessorKey: 'fundLastPayoutTime',
        header: t('tokenized_deposit_0157'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>
              {val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* 标题行：tokenized_deposit_0158 + 副标题 */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {t('tokenized_deposit_0158')}
          </span>
          <span className="text-xs text-muted-foreground">
            ({t('tokenized_deposit_0159')}: {subtitleDate})
          </span>
        </div>
      </div>

      <div className="p-4">
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
    </div>
  );
}
