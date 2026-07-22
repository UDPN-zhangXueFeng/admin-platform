'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useDividendRecordsQuery,
  useDividendSummaryQuery,
  type DividendRow,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import { DEFAULT_PAGE_SIZE, EMPTY_DISPLAY, toMillis } from '@myorg/modules/wallet/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FMT = 'YYYY-MM-DD';

/** 时间戳格式化（秒/毫秒自适应），无值返回占位。 */
function formatTs(
  ts?: number | string | null,
  fmt = DATETIME_FMT
): string {
  const ms = toMillis(typeof ts === 'string' ? Number(ts) : ts);
  return ms ? formatDate(ms, fmt) : EMPTY_DISPLAY;
}

/** 千分位 + 2 位小数（迁移自源 reSet）。 */
function reSet(value?: number | string | null): string {
  if (value === undefined || value === null || value === '') return EMPTY_DISPLAY;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY_DISPLAY;
  return n
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

interface TxPage {
  pageNum: number;
  pageSize: number;
}

interface WalletTypeDividendDrawerProps {
  open: boolean;
  billCode?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * WalletTypeDividendDrawer — MMF 日收益「查看」股息明细抽屉。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/mff/view.tsx` 中的 antd Drawer：
 * - useDividendSummaryQuery(billCode) 汇总 kv；
 * - useDividendRecordsQuery(billCode, page) 明细表（分页，状态列 mmf-daily 族）。
 * billCode 缺失（抽屉关闭）时两 hook 均不发起请求（enabled 自动处理）。
 */
export function WalletTypeDividendDrawer({
  open,
  billCode,
  onOpenChange,
}: WalletTypeDividendDrawerProps) {
  const t = useTranslations('modules.wallet');

  const summaryQuery = useDividendSummaryQuery(billCode, open);
  const summary = summaryQuery.data;

  const [page, setPage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  // billCode 变化时重置分页。
  React.useEffect(() => {
    setPage({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [billCode]);

  const recordsQuery = useDividendRecordsQuery(billCode, page, open);

  const summaryRows = React.useMemo<KvRow[]>(() => {
    return [
      {
        key: 'earningsDate',
        label: t('walletType.column.recordDate'),
        value: formatTs(summary?.earningsDate, DATE_FMT),
      },
      {
        key: 'payableOn',
        label: t('walletType.column.appliedOn'),
        value: formatTs(summary?.payableOn),
      },
      {
        key: 'totalUnits',
        label: t('walletType.column.totalShares'),
        value:
          summary?.totalUnits != null
            ? `${summary.totalUnits} ${summary.totalUnitsSymbol ?? ''}`.trim()
            : EMPTY_DISPLAY,
      },
      {
        key: 'totalEarnings',
        label: t('walletType.column.dailyDividendAmount'),
        value:
          summary?.totalEarnings != null
            ? `${summary.totalEarnings} ${summary.totalEarningsCurrency ?? ''}`.trim()
            : EMPTY_DISPLAY,
      },
      {
        key: 'perEarningsUnits',
        label: t('walletType.column.earningsPerShares'),
        value:
          summary?.perEarningsUnits != null
            ? `${summary.perEarningsUnits} ${
                summary.totalEarningsCurrency ?? ''
              }`.trim()
            : EMPTY_DISPLAY,
      },
      {
        key: 'totalWallets',
        label: t('walletType.column.totalWallets'),
        value: summary?.totalWallets ?? EMPTY_DISPLAY,
      },
    ];
  }, [summary, t]);

  const columns = React.useMemo<ColumnDef<DividendRow>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: t('walletType.column.userWalletAddress'),
        cell: ({ row }) => (
          <span className="break-all">
            {row.original.walletAddress || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'stablecoinCount',
        header: t('walletType.column.totalShares'),
        cell: ({ row }) => (
          <span>
            {row.original.stablecoinCount != null
              ? `${reSet(row.original.stablecoinCount)} ${
                  row.original.stablecoinSymbol ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'dividendAmount',
        header: t('walletType.column.dailyDividendAmount'),
        cell: ({ row }) => (
          <span>
            {row.original.dividendAmount != null
              ? `${reSet(row.original.dividendAmount)} ${
                  row.original.dividendAmountCurrency ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'dividendUnits',
        header: t('walletType.column.applicableDividends'),
        cell: ({ row }) => (
          <span>
            {row.original.dividendUnits != null
              ? `${reSet(row.original.dividendUnits)} ${
                  row.original.stablecoinSymbol ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'txTime',
        header: t('walletType.column.txTime'),
        cell: ({ row }) => <span>{formatTs(row.original.txTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('walletType.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge family="mmf-daily" status={row.original.status} />
        ),
      },
    ],
    [t]
  );

  const rows = recordsQuery.data?.rows ?? [];
  const total = recordsQuery.data?.page?.total ?? 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex w-3/5 max-w-none flex-col">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('walletType.dividend.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          <DividendSummarySection rows={summaryRows} />
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('walletType.dividend.detailsTitle')}
            </div>
            <div className="p-4">
              <DataTable
                columns={columns}
                data={rows}
                isLoading={recordsQuery.isLoading || recordsQuery.isFetching}
                emptyMessage={t('common.noData')}
                pagination={{
                  page: page.pageNum,
                  pageSize: page.pageSize,
                  total,
                  onPageChange: (p) =>
                    setPage((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** 股息汇总 kv 卡片。 */
function DividendSummarySection({ rows }: { rows: KvRow[] }) {
  const t = useTranslations('modules.wallet');
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">
        {/* 源 mff/view.tsx items1 卡片标题 = wallet_type_120 (Summary)。 */}
        {t('walletType.dividend.summaryTitle')}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <tbody>
            {!rows.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground">
                  {EMPTY_DISPLAY}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                    {row.label}
                  </td>
                  <td className="break-all border px-4 py-3">{row.value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
