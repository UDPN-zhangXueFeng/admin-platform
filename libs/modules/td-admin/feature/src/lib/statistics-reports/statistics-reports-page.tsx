'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  useToast,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { DatePicker } from '@myorg/shared/ui-forms';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useAbcCount,
  useAbcVolume,
  useSpTransaction,
  useStablecoinList,
  useStablecoinsOverview,
  useTokenTypes,
  useTokenizedDepositsList,
  useWalletQuantity,
} from '@myorg/modules/td-admin/data-access';
import type {
  ChartDataItem,
  CoinOption,
  TokenListItem,
} from '@myorg/modules/td-admin/data-access';
import {
  DEFAULT_TIME_RANGE,
  STATISTICS_REPORT_MESSAGE_KEYS,
  TABLE_PAGE_SIZE,
  TIME_RANGE_OPTIONS,
  type TimeRangePreset,
} from './statistics-reports.constants';
import { formatAmount } from './statistics-reports.utils';
import { StatisticsPieCard } from './statistics-pie-card';
import { StatisticsActivityCharts } from './statistics-activity-charts';
import { downloadStatisticsReport } from './statistics-report-export';

type TokenListRow = TokenListItem & { id: string };

const EMPTY_COIN_OPTIONS: CoinOption[] = [];

/** Endpoints on start-of-day boundaries, exactly like the upstream presets. */
function presetRange(preset: Exclude<TimeRangePreset, 'custom'>): [number, number] {
  const end = dayjs().startOf('day');
  const start =
    preset === 'last7days'
      ? end.subtract(7, 'day')
      : preset === 'last14days'
        ? end.subtract(14, 'day')
        : end.subtract(1, 'month');
  return [start.valueOf(), end.valueOf()];
}

/** Custom window: inclusive end-of-day, at most one calendar month wide. */
function customRange(startIso: string, endIso: string): [number, number] | null {
  if (!startIso || !endIso) return null;
  const start = dayjs(startIso).startOf('day');
  const end = dayjs(endIso).endOf('day');
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return null;
  if (end.startOf('day').isAfter(start.add(1, 'month'))) return null;
  return [start.valueOf(), end.valueOf()];
}

export function StatisticsReportsPage() {
  const t = useTranslations('modules.statistics-reports');
  const locale = useLocale();
  const toast = useToast();

  // ── token type tabs ──────────────────────────────────────────────────────
  const {
    data: tokenTypes,
    isLoading: typesLoading,
    isError: typesError,
    refetch: refetchTypes,
  } = useTokenTypes();
  const [tokenTypeId, setTokenTypeId] = React.useState('');
  // Defaults to the first active type once; refetches never reset the user tab.
  React.useEffect(() => {
    setTokenTypeId((previous) => {
      if (previous) return previous;
      const active = (tokenTypes ?? []).filter((item) => item.status === 1);
      return active[0]?.tokenTypeId ?? '';
    });
  }, [tokenTypes]);

  const isStablecoin = Number(tokenTypeId) === 1;
  const isMmf = Number(tokenTypeId) === 20;

  // ── date range ───────────────────────────────────────────────────────────
  // Synchronous default avoids the initial "0 request" the upstream page made.
  const [timeRange, setTimeRange] = React.useState<TimeRangePreset>(DEFAULT_TIME_RANGE);
  const [dateRange, setDateRange] = React.useState<[number, number] | null>(() =>
    presetRange(DEFAULT_TIME_RANGE),
  );
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  const applyPreset = (preset: TimeRangePreset) => {
    setTimeRange(preset);
    if (preset === 'custom') {
      setDateRange(null); // stays idle until both custom dates are valid
      return;
    }
    setCustomStart('');
    setCustomEnd('');
    setDateRange(presetRange(preset));
  };

  const applyCustomDates = (startIso: string, endIso: string) => {
    setCustomStart(startIso);
    setCustomEnd(endIso);
    setTimeRange('custom');
    setDateRange(customRange(startIso, endIso));
  };

  const handleCustomStart = (value: string) => {
    if (customEnd && dayjs(value).isAfter(dayjs(customEnd))) {
      applyCustomDates(value, ''); // reversed input clears the end date
    } else {
      applyCustomDates(value, customEnd);
    }
  };

  const handleCustomEnd = (value: string) => {
    if (customStart && dayjs(value).isBefore(dayjs(customStart))) {
      applyCustomDates('', value);
    } else {
      applyCustomDates(customStart, value);
    }
  };

  const customRangeInvalid =
    timeRange === 'custom' && !!customStart && !!customEnd && dateRange === null;

  // ── overview ─────────────────────────────────────────────────────────────
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useStablecoinsOverview(tokenTypeId);

  const chartData: ChartDataItem[] = overview
    ? [
        {
          title: isStablecoin ? t('statistics_reports_0001') : t('statistics_reports_0002'),
          count: overview.stablecoinsCount,
          chartData: [],
          showChart: false,
        },
        {
          title: t('statistics_reports_0003'),
          count: overview.serviceProvidersCount,
          chartData: (overview.serviceProvidersProportion ?? []).map((item) => ({
            value: item.count,
            name: item.tokenName,
          })),
        },
        {
          title: t('statistics_reports_0004'),
          count: overview.walletsCount,
          chartData: (overview.walletsProportion ?? []).map((item) => ({
            value: item.count,
            name: item.tokenName,
          })),
        },
        {
          title: t('statistics_reports_0005'),
          count: overview.transactionCount,
          chartData: (overview.transactionCountProportion ?? []).map((item) => ({
            value: item.count,
            name: item.tokenName,
          })),
        },
      ]
    : [];

  // ── coins ────────────────────────────────────────────────────────────────
  const [selectedCoin, setSelectedCoin] = React.useState('');
  const {
    data: coinOptions = EMPTY_COIN_OPTIONS,
    isLoading: coinsLoading,
    isError: coinsError,
    refetch: refetchCoins,
  } = useStablecoinList(tokenTypeId);

  // Empty list clears the selection; a fresh list selects its first coin —
  // the user's date range is untouched by coin (or type) changes.
  React.useEffect(() => {
    setSelectedCoin((previous) => {
      if (coinOptions.length === 0) return '';
      return coinOptions.some((coin) => coin.value === previous)
        ? previous
        : coinOptions[0].value;
    });
  }, [coinOptions]);

  const selectedCoinOption = coinOptions.find((coin) => coin.value === selectedCoin);
  // ── activity series ──────────────────────────────────────────────────────
  const activityStart = dateRange?.[0] ?? 0;
  const activityEnd = dateRange?.[1] ?? 0;
  const walletQuery = useWalletQuantity(selectedCoin, activityStart, activityEnd);
  const spQuery = useSpTransaction(selectedCoin, activityStart, activityEnd);
  const abcCountQuery = useAbcCount(selectedCoin, activityStart, activityEnd);
  const abcVolumeQuery = useAbcVolume(selectedCoin, activityStart, activityEnd);

  const activityLoading =
    walletQuery.isLoading || spQuery.isLoading || abcCountQuery.isLoading || abcVolumeQuery.isLoading;
  const activityError =
    walletQuery.isError || spQuery.isError || abcCountQuery.isError || abcVolumeQuery.isError;
  const retryActivity = () => {
    walletQuery.refetch();
    spQuery.refetch();
    abcCountQuery.refetch();
    abcVolumeQuery.refetch();
  };

  // ── tokenized deposits table ─────────────────────────────────────────────
  const [pagination, setPagination] = React.useState({ pageNum: 1, pageSize: TABLE_PAGE_SIZE });
  const {
    data: tokenList,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useTokenizedDepositsList(tokenTypeId, pagination.pageNum, pagination.pageSize);
  const listRows = tokenList?.rows ?? [];
  const listTotal = tokenList?.page?.total ?? 0;

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pagination.pageNum,
      pageSize: pagination.pageSize,
      total: listTotal,
      onPageChange: (page) =>
        setPagination((previous) => ({ ...previous, pageNum: page })),
    }),
    [pagination.pageNum, pagination.pageSize, listTotal],
  );

  const columns = React.useMemo<ColumnDef<TokenListRow>[]>(() => {
    const indexColumn: ColumnDef<TokenListRow> = {
      id: 'index',
      header: t('index'),
      cell: ({ row }) =>
        row.original.todoId ??
        (pagination.pageNum - 1) * pagination.pageSize + row.index + 1,
    };
    const tokenNameColumn: ColumnDef<TokenListRow> = {
      accessorKey: 'tokenName',
      header: t('statistics_reports_0023'),
    };
    const tokenPriceColumn: ColumnDef<TokenListRow> = {
      id: 'tokenPrice',
      header: t('statistics_reports_0022'),
      cell: ({ row }) =>
        `1 ${row.original.tokenSymbol} = 1 ${row.original.currencySymbol}`,
    };
    const blockchainColumn: ColumnDef<TokenListRow> = {
      accessorKey: 'blockchain',
      header: t('statistics_reports_0021'),
    };
    const providersColumn: ColumnDef<TokenListRow> = {
      accessorKey: 'serviceProviders',
      header: t('statistics_reports_0003'),
    };
    const walletsColumn: ColumnDef<TokenListRow> = {
      accessorKey: 'wallets',
      header: t('statistics_reports_0004'),
    };
    const statusColumn: ColumnDef<TokenListRow> = {
      accessorKey: 'tokenStatus',
      header: t('statistics_reports_0017'),
      cell: ({ row }) =>
        Number(row.original.tokenStatus) === 1
          ? t('statistics_reports_0015')
          : t('statistics_reports_0016'),
    };
    const amountColumn = (
      accessorKey: keyof TokenListItem,
      headerKey: string,
      symbolKey: 'tokenSymbol' | 'currencySymbol',
    ): ColumnDef<TokenListRow> => ({
      accessorKey,
      header: t(headerKey),
      cell: ({ row }) =>
        `${formatAmount(row.original[accessorKey])} ${row.original[symbolKey]}`,
    });

    if (isStablecoin) {
      return [
        indexColumn,
        tokenNameColumn,
        tokenPriceColumn,
        blockchainColumn,
        amountColumn('reserveAccount', 'statistics_reports_0028', 'currencySymbol'),
        amountColumn('repositoryBalance', 'statistics_reports_0027', 'tokenSymbol'),
        amountColumn('stablecoinsInCirculation', 'statistics_reports_0026', 'tokenSymbol'),
        amountColumn('totalMinted', 'statistics_reports_0025', 'tokenSymbol'),
        amountColumn('totalMelted', 'statistics_reports_0024', 'tokenSymbol'),
        providersColumn,
        walletsColumn,
        statusColumn,
      ];
    }
    return [
      indexColumn,
      tokenNameColumn,
      tokenPriceColumn,
      blockchainColumn,
      amountColumn('stablecoinsInCirculation', 'statistics_reports_0020', 'tokenSymbol'),
      amountColumn('totalMinted', 'statistics_reports_0019', 'tokenSymbol'),
      amountColumn('totalMelted', 'statistics_reports_0018', 'tokenSymbol'),
      providersColumn,
      walletsColumn,
      statusColumn,
    ];
  }, [t, isStablecoin, pagination.pageNum, pagination.pageSize]);

  const tableRows = React.useMemo<TokenListRow[]>(
    () =>
      listRows.map((row, index) => ({
        ...row,
        id: String(row.stablecoinId ?? `${pagination.pageNum}-${index}`),
      })),
    [listRows, pagination.pageNum],
  );

  // ── print / save as PDF (whole type report, independent of selected coin) ─
  const [printing, setPrinting] = React.useState(false);
  const reportMessages = React.useMemo<Record<string, string>>(() => {
    const resolved: Record<string, string> = {};
    for (const key of STATISTICS_REPORT_MESSAGE_KEYS) {
      if (t.has(key)) {
        const raw = t.raw(key);
        if (typeof raw === 'string') resolved[key] = raw;
      }
    }
    return resolved;
  }, [t]);

  const handlePrint = async () => {
    if (!tokenTypeId || !dateRange || printing) return;
    setPrinting(true);
    try {
      await downloadStatisticsReport({
        tokenTypeId,
        dateRange,
        locale,
        messages: reportMessages,
      });
    } catch (error) {
      toast.error(t('statistics_reports_0013'), {
        description:
          error instanceof Error && error.message
            ? error.message
            : t('statistics_reports_0014'),
      });
    } finally {
      setPrinting(false);
    }
  };

  const asOfTime = React.useMemo(() => formatAdminDateTime(new Date()), []);

  const overviewTitle = isStablecoin
    ? t('statistics_reports_0006')
    : isMmf
      ? t('statistics_reports_0045')
      : t('statistics_reports_0007');
  const activityTitle = isStablecoin
    ? t('statistics_reports_0008')
    : isMmf
      ? t('statistics_reports_0046')
      : t('statistics_reports_0009');
  const tableTitle = isStablecoin
    ? t('statistics_reports_0010')
    : isMmf
      ? t('statistics_reports_0047')
      : t('statistics_reports_0011');

  return (
    <div className="space-y-4">
      {(typesLoading || typesError) && (
        <QueryStatus
          isLoading={typesLoading}
          isError={typesError}
          onRetry={refetchTypes}
          labels={{
            loading: t('loading'),
            loadFailed: t('loadFailed'),
            retry: t('retry'),
          }}
        />
      )}

      <Tabs
        value={tokenTypeId}
        onValueChange={(key) => {
          // Switching type resets page and coin selection so no stale
          // coin activity from the previous type can remain visible.
          setTokenTypeId(key);
          setSelectedCoin('');
          setPagination((previous) => ({ ...previous, pageNum: 1 }));
          applyPreset(DEFAULT_TIME_RANGE);
        }}
      >
        <TabsList>
          {(tokenTypes ?? [])
            .filter((item) => item.status === 1)
            .map((item) => (
              <TabsTrigger key={item.tokenTypeId} value={item.tokenTypeId}>
                {item.tokenTypeName}
              </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>

      {/* Overview */}
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold">{overviewTitle}</h3>
          <Button onClick={handlePrint} disabled={!dateRange || !tokenTypeId || printing}>
            {printing && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            {printing ? t('statistics_reports_0012') : t('statistics_reports_0029')}
          </Button>
        </div>
        {overviewError ? (
          <QueryStatus
            isLoading={false}
            isError
            onRetry={refetchOverview}
            labels={{
              loading: t('loading'),
              loadFailed: t('loadFailed'),
              retry: t('retry'),
            }}
          />
        ) : overviewLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-lg border bg-muted/40"
                aria-hidden
              />
            ))}
          </div>
        ) : chartData.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {chartData.map((item, index) => (
              <StatisticsPieCard
                key={index}
                title={item.title}
                count={item.count}
                chartData={item.chartData}
                showChart={item.showChart !== false}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('statistics_reports_0043')}
          </div>
        )}
      </Card>

      {/* Activity */}
      <Card className="p-4">
        <h3 className="mb-4 text-base font-extrabold">{activityTitle}</h3>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Select
            value={selectedCoin}
            onValueChange={(value: string) => setSelectedCoin(value)}
          >
            <SelectTrigger className="w-full lg:w-56" aria-label={t('statistics_reports_0023')}>
              <SelectValue placeholder={t('statistics_reports_0043')} />
            </SelectTrigger>
            <SelectContent>
              {coinOptions.map((coin) => (
                <SelectItem key={coin.value} value={coin.value}>
                  {coin.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={timeRange}
            onValueChange={(value: string) => applyPreset(value as TimeRangePreset)}
          >
            <SelectTrigger className="w-full lg:w-44" aria-label={t('statistics_reports_0033')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timeRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                value={customStart}
                onChange={handleCustomStart}
                max={customEnd || undefined}
                min={customEnd ? dayjs(customEnd).subtract(1, 'month').format('YYYY-MM-DD') : undefined}
                ariaLabel={t('date')}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">{t('statistics_reports_0044')}</span>
              <DatePicker
                value={customEnd}
                onChange={handleCustomEnd}
                min={customStart || undefined}
                max={customStart ? dayjs(customStart).add(1, 'month').format('YYYY-MM-DD') : undefined}
                ariaLabel={t('date')}
                className="w-40"
              />
            </div>
          )}
          {coinsLoading && <span className="text-sm text-muted-foreground">{t('loading')}</span>}
          {coinsError && (
            <Button variant="outline" size="sm" onClick={() => refetchCoins()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('retry')}
            </Button>
          )}
          {customRangeInvalid && (
            <span className="text-sm text-destructive">{t('invalidDateRange')}</span>
          )}
        </div>
        <QueryStatus
          isLoading={activityLoading}
          isError={activityError}
          onRetry={retryActivity}
          labels={{
            loading: t('loading'),
            loadFailed: t('loadFailed'),
            retry: t('retry'),
          }}
        />
        <StatisticsActivityCharts
          messages={reportMessages}
          walletData={walletQuery.data}
          spData={spQuery.data}
          abcCount={abcCountQuery.data}
          abcVolume={abcVolumeQuery.data}
          coinName={selectedCoinOption?.label}
          symbol={selectedCoinOption?.symbol}
        />
      </Card>

      {/* Table */}
      <Card className="p-4">
        <h3 className="mb-4 text-base font-extrabold">
          {tableTitle} ({t('statistics_reports_0034')} {asOfTime})
        </h3>
        <QueryStatus
          isLoading={listLoading}
          isError={listError}
          onRetry={refetchList}
          labels={{
            loading: t('loading'),
            loadFailed: t('loadFailed'),
            retry: t('retry'),
          }}
        />
        <DataTable
          columns={columns}
          data={tableRows}
          isLoading={listLoading}
          pagination={tablePagination}
          emptyMessage={t('statistics_reports_0043')}
        />
      </Card>
    </div>
  );
}

/** Shared inline loading / error-with-retry strip for section queries. */
function QueryStatus({
  isLoading,
  isError,
  onRetry,
  labels,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  labels: { loading: string; loadFailed: string; retry: string };
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {labels.loading}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <span>{labels.loadFailed}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
          {labels.retry}
        </Button>
      </div>
    );
  }
  return null;
}
