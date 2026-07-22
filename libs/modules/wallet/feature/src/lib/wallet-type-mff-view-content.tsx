'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  CopyableEllipsisText,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useAccumulatedEarningsQuery,
  useDailyYieldQuery,
  type DailyYieldRow,
  type WalletTypeDetail,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  toMillis,
} from '@myorg/modules/wallet/util';
import { WalletTypeDividendDrawer } from './wallet-type-dividend-drawer';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FMT = 'YYYY-MM-DD';

const BASIC_TAB = 'basic';
const DAILY_TAB = 'daily';

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

interface TxPage {
  pageNum: number;
  pageSize: number;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/** Descriptions 卡片区段。 */
function DescriptionsSection({
  title,
  rows,
}: {
  title: string;
  rows: KvRow[];
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      {title ? (
        <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      ) : null}
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

interface WalletTypeMffViewContentProps {
  ruleId?: number;
  detail?: WalletTypeDetail;
  isLoading?: boolean;
}

/**
 * WalletTypeMffViewContent — MMF 钱包类型详情（2 tab + 累计收益 + 股息抽屉）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/mff/view.tsx`（509 行）。
 * - Tab1 基本信息：detail kv + 派息钱包地址 + 派息记录时间提示；
 * - Tab2 每日收益：累计收益 kv（useAccumulatedEarningsQuery）+ 日收益表（分页，状态列
 *   mmf-daily 族）。行「查看」按钮 → 打开股息抽屉（billCode 触发）。
 *
 * 由 WalletTypeDetailPage 在 slug[1]=`mff` 时渲染。
 */
export function WalletTypeMffViewContent({
  ruleId,
  detail,
  isLoading,
}: WalletTypeMffViewContentProps) {
  const t = useTranslations('modules.wallet');

  const [dailyPage, setDailyPage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const dailyList = useDailyYieldQuery(ruleId, dailyPage);

  const accumulatedQuery = useAccumulatedEarningsQuery(ruleId);
  // 源项目 accumulatedEarnings 为字符串展示；空值兜底占位。
  const accumulated =
    accumulatedQuery.data !== undefined && accumulatedQuery.data !== null
      ? String(accumulatedQuery.data)
      : '';

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [billCode, setBillCode] = React.useState<string | undefined>(undefined);

  const handleOpenDrawer = React.useCallback((code?: string) => {
    if (!code) return;
    setBillCode(code);
    setDrawerOpen(true);
  }, []);

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const fundTypeKey = detail.fundType
      ? `walletType.mmfFundType.${detail.fundType}`
      : undefined;
    const riskLevelKey = detail.riskLevel
      ? `walletType.mmfRiskLevel.${detail.riskLevel}`
      : undefined;
    return [
      {
        key: 'tokenName',
        label: t('walletType.detail.tokenName'),
        value:
          detail.tokenName || detail.blockchainName
            ? `${detail.tokenName ?? ''} (${detail.blockchainName ?? ''})`
            : EMPTY_DISPLAY,
      },
      {
        key: 'accountType',
        label: t('walletType.column.accountType'),
        value: detail.accountType
          ? (t(`accountType.${detail.accountType}` as never) as string)
          : EMPTY_DISPLAY,
      },
      {
        key: 'name',
        label: t('walletType.detail.fundName'),
        value: detail.name || EMPTY_DISPLAY,
      },
      {
        key: 'walletTypeCode',
        label: t('walletType.detail.fundCode'),
        value: detail.walletTypeCode || EMPTY_DISPLAY,
      },
      {
        key: 'fundType',
        label: t('walletType.column.fundType'),
        value: fundTypeKey ? (t(fundTypeKey as never) as string) : EMPTY_DISPLAY,
      },
      {
        key: 'riskLevel',
        label: t('walletType.column.riskLevel'),
        value: riskLevelKey
          ? (t(riskLevelKey as never) as string)
          : EMPTY_DISPLAY,
      },
      {
        key: 'fundAssetValue',
        label: t('walletType.detail.fixedNetAssetValue'),
        value:
          detail.fundAssetValue != null
            ? `${detail.fundAssetValue} ${detail.currencySymbol ?? ''}`.trim()
            : EMPTY_DISPLAY,
      },
      {
        key: 'fundInceptionTime',
        label: t('walletType.column.fundInceptionTime'),
        value: formatTs(detail.fundInceptionTime, DATE_FMT),
      },
      {
        key: 'createUser',
        label: t('walletType.detail.updatedBy'),
        value: detail.createUser || EMPTY_DISPLAY,
      },
      {
        key: 'createTime',
        label: t('walletType.detail.updatedOn'),
        value: formatTs(detail.createTime),
      },
      {
        key: 'status',
        label: t('common.status'),
        value: (
          <WalletStatusBadge family="wallet-type" status={detail.status ?? detail.state} />
        ),
      },
    ];
  }, [detail, t]);

  // tab2 顶部累计收益 kv（迁移自源 items + 累计收益）。
  const summaryRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'name',
        label: t('walletType.detail.fundName'),
        value: detail.name || EMPTY_DISPLAY,
      },
      {
        key: 'dividendMethod',
        label: t('walletType.detail.dividendMethod'),
        // 源硬编码 'Reinvestment'。
        value: t('walletType.detail.reinvestment'),
      },
      {
        key: 'fundAssetValue',
        label: t('walletType.detail.fixedNetAssetValue'),
        value:
          detail.fundAssetValue != null
            ? `${detail.fundAssetValue} ${detail.currencySymbol ?? ''}`.trim()
            : EMPTY_DISPLAY,
      },
      {
        key: 'accumulatedEarnings',
        label: t('walletType.detail.totalRecordedDividends'),
        value: accumulated
          ? `${accumulated} ${detail.currencySymbol ?? ''}`.trim()
          : EMPTY_DISPLAY,
      },
    ];
  }, [detail, accumulated, t]);

  const dailyColumns = React.useMemo<ColumnDef<DailyYieldRow>[]>(
    () => [
      {
        id: 'fundInceptionTimeStart',
        header: t('walletType.column.recordDate'),
        cell: ({ row }) => (
          <span>{formatTs(row.original.fundInceptionTimeStart, DATE_FMT)}</span>
        ),
      },
      {
        id: 'totalUnits',
        header: t('walletType.column.totalShares'),
        cell: ({ row }) => (
          <span>
            {row.original.totalUnits != null
              ? `${reSet(row.original.totalUnits)} ${
                  row.original.tokenCurrencySymbol ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'totalEarnings',
        header: t('walletType.column.dailyDividendAmount'),
        cell: ({ row }) => (
          <span>
            {row.original.totalEarnings != null
              ? `${reSet(row.original.totalEarnings)} ${
                  row.original.currencySymbol ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'earningPerUnits',
        header: t('walletType.column.earningsPerShares'),
        cell: ({ row }) => (
          <span>
            {row.original.earningPerUnits != null
              ? `${reSet(row.original.earningPerUnits)} ${
                  row.original.currencySymbol ?? ''
                }`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'totalWallets',
        header: t('walletType.column.totalWallets'),
        cell: ({ row }) => (
          <span>{row.original.totalWallets ?? EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createdBy',
        header: t('walletType.column.creator'),
        cell: ({ row }) => <span>{row.original.createdBy || EMPTY_DISPLAY}</span>,
      },
      {
        id: 'payableOn',
        header: t('walletType.column.createTime'),
        cell: ({ row }) => <span>{formatTs(row.original.payableOn)}</span>,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge family="mmf-daily" status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: t('common.operate'),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => handleOpenDrawer(row.original.billCode)}
          >
            {t('walletType.action.details')}
          </button>
        ),
      },
    ],
    [t, handleOpenDrawer]
  );

  const dailyRows = dailyList.data?.rows ?? [];
  const dailyTotal = dailyList.data?.page?.total ?? 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue={BASIC_TAB}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('walletType.tab.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={DAILY_TAB}>
            {t('walletType.tab.dailyYield')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={BASIC_TAB}>
          <div className="space-y-4">
            <DescriptionsSection
              title={t('walletType.detail.basicInformation')}
              rows={basicRows}
            />
            <DescriptionsSection
              title={t('walletType.detail.walletInformation')}
              rows={[
                {
                  key: 'depositInterestWalletAddress',
                  label: t('walletType.detail.dividendPayoutWallet'),
                  value: detail?.depositInterestWalletAddress ? (
                    <CopyableEllipsisText
                      value={detail.depositInterestWalletAddress}
                      copyLabel={t('walletType.copy')}
                    />
                  ) : (
                    EMPTY_DISPLAY
                  ),
                },
              ]}
            />
            <DescriptionsSection
              title={t('walletType.detail.dividendRecordTime')}
              rows={[
                {
                  key: 'dailyStatisticalTime',
                  label: t('walletType.detail.recordedOn'),
                  value: detail?.dailyStatisticalTime
                    ? `${t('walletType.detail.dailyAt')} ${detail.dailyStatisticalTime}`
                    : EMPTY_DISPLAY,
                },
              ]}
            />
            <div className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
              <span className="text-primary">ⓘ</span>
              <span className="flex-1">{t('walletType.detail.dividendSnapshotTip')}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value={DAILY_TAB}>
          <div className="space-y-4">
            <DescriptionsSection
              title={t('walletType.detail.summary')}
              rows={summaryRows}
            />
            <section className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-3 text-sm font-semibold">
                {t('walletType.detail.dailyYieldList')}
              </div>
              <div className="p-4">
                <DataTable
                  columns={dailyColumns}
                  data={dailyRows}
                  isLoading={dailyList.isLoading || dailyList.isFetching}
                  emptyMessage={t('common.noData')}
                  pagination={{
                    page: dailyPage.pageNum,
                    pageSize: dailyPage.pageSize,
                    total: dailyTotal,
                    onPageChange: (page) =>
                      setDailyPage((prev) => ({ ...prev, pageNum: page })),
                  }}
                />
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <WalletTypeDividendDrawer
        open={drawerOpen}
        billCode={billCode}
        onOpenChange={setDrawerOpen}
      />

      {!ruleId && !isLoading ? (
        <p className="text-center text-sm text-muted-foreground">
          {t('walletType.invalidId')}
        </p>
      ) : null}
    </div>
  );
}
