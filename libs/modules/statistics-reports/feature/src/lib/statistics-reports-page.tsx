'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, DataTable, type DataTablePagination, Tabs, type TabItem, Select } from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import dayjs from 'dayjs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTokenTypes, useStablecoinsOverview, useStablecoinList, useTokenizedDepositsList, useWalletQuantity, useSpTransaction, useAbcCount, useAbcVolume } from '@myorg/modules/statistics-reports/data-access';
import type { ChartDataItem, CoinOption, DataPoint, DoubleDataPoint, MultiLineDataPoint } from '@myorg/modules/statistics-reports/data-access';
import { TIME_RANGE_OPTIONS, DOWNLOAD_PERMISSION } from '@myorg/modules/statistics-reports/util';
import { StatisticsPieCard } from '@myorg/modules/statistics-reports/ui';

const PAGE_SIZE = 10;

export function StatisticsReportsPage() {
  const t = useTranslations('modules.statistics-reports'); const tc = useTranslations('common');
  const { hasLimit } = useAuth();
  const { data: tokenTypes } = useTokenTypes();
  const [tokenTypeId, setTokenTypeId] = React.useState<string>('');
  const [selectedCoin, setSelectedCoin] = React.useState('');
  const [coinOptions, setCoinOptions] = React.useState<CoinOption[]>([]);
  const [timeRange, setTimeRange] = React.useState('last7days');
  const [dateRange, setDateRange] = React.useState<[number, number] | null>(null);
  const [pg, setPg] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: PAGE_SIZE });

  React.useEffect(() => { if (tokenTypes?.length) { const active = tokenTypes.filter(tt => tt.status === 1); if (active.length) setTokenTypeId(active[0].tokenTypeId); } }, [tokenTypes]);
  const { data: overview } = useStablecoinsOverview(tokenTypeId);
  const { data: scList } = useStablecoinList(tokenTypeId);
  React.useEffect(() => { if (scList?.length) { setCoinOptions(scList); if (!selectedCoin) setSelectedCoin(scList[0].value); } }, [scList]);

  const { data: tokenList } = useTokenizedDepositsList(tokenTypeId, pg.pageNum, PAGE_SIZE);
  const { data: walletData } = useWalletQuantity(selectedCoin, dateRange?.[0] || 0, dateRange?.[1] || 0);
  const { data: spData } = useSpTransaction(selectedCoin, dateRange?.[0] || 0, dateRange?.[1] || 0);
  const { data: abcCount } = useAbcCount(selectedCoin, dateRange?.[0] || 0, dateRange?.[1] || 0);
  const { data: abcVolume } = useAbcVolume(selectedCoin, dateRange?.[0] || 0, dateRange?.[1] || 0);

  const handleTimeRange = (v: string) => {
    setTimeRange(v);
    const end = dayjs().startOf('day');
    let start: dayjs.Dayjs;
    switch (v) {
      case 'last7days': start = end.subtract(7, 'day'); break;
      case 'last14days': start = end.subtract(14, 'day'); break;
      case 'lastMonth': start = end.subtract(1, 'month'); break;
      default: return;
    }
    setDateRange([start.valueOf(), end.valueOf()]);
  };
  React.useEffect(() => { handleTimeRange('last7days'); }, [selectedCoin]);

  const chartData: ChartDataItem[] = overview ? [
    { title: Number(tokenTypeId) === 1 ? t('statistics_reports_0001') : t('statistics_reports_0002'), count: overview.stablecoinsCount, chartData: [], showChart: false },
    { title: t('statistics_reports_0003'), count: overview.serviceProvidersCount, chartData: overview.serviceProvidersProportion?.map(i => ({ value: i.count, name: i.tokenName })) || [] },
    { title: t('statistics_reports_0004'), count: overview.walletsCount, chartData: overview.walletsProportion?.map(i => ({ value: i.count, name: i.tokenName })) || [] },
    { title: t('statistics_reports_0005'), count: overview.transactionCount, chartData: overview.transactionCountProportion?.map(i => ({ value: i.count, name: i.tokenName })) || [] },
  ] : [];

  const walletChart = (walletData || []).map(d => ({ date: d.date, value: d.value }));
  const spChart = (spData || []).map(d => ({ date: d.date, count: d.count, volume: d.volume }));
  const abcCountChart = (abcCount || []).map(d => ({ date: d.date, TopUp: d.topUpCount, Transfer: d.transferCount, Withdrawal: d.withdrawalCount }));
  const abcVolumeChart = (abcVolume || []).map(d => ({ date: d.date, TopUp: d.topUpVolume ?? d.topUpCount, Transfer: d.transferVolume ?? d.transferCount, Withdrawal: d.withdrawalVolume ?? d.withdrawalCount }));

  const selectedCoinObj = coinOptions.find(c => c.value === selectedCoin);
  const isStablecoin = Number(tokenTypeId) === 1;
  const cols = isStablecoin ? [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'todoId' as const, cell: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { id: 'tokenName', header: t('statistics_reports_0023'), accessorKey: 'tokenName' as const },
    { id: 'tokenPrice', header: t('statistics_reports_0022'), accessorKey: 'tokenPrice' as const, cell: (_: unknown, row: { tokenSymbol: string; currencySymbol: string }) => `1 ${row.tokenSymbol} = 1 ${row.currencySymbol}` },
    { id: 'blockchain', header: t('statistics_reports_0021'), accessorKey: 'blockchain' as const },
    { id: 'reserveAccount', header: t('statistics_reports_0028'), accessorKey: 'reserveAccount' as const, cell: (_: unknown, row: { reserveAccount: number; currencySymbol: string }) => `${row.reserveAccount || '-'} ${row.currencySymbol}` },
    { id: 'repositoryBalance', header: t('statistics_reports_0027'), accessorKey: 'repositoryBalance' as const, cell: (_: unknown, row: { repositoryBalance: number; tokenSymbol: string }) => `${row.repositoryBalance || '-'} ${row.tokenSymbol}` },
    { id: 'circulation', header: t('statistics_reports_0026'), accessorKey: 'stablecoinsInCirculation' as const, cell: (_: unknown, row: { stablecoinsInCirculation: number; tokenSymbol: string }) => `${row.stablecoinsInCirculation || '-'} ${row.tokenSymbol}` },
    { id: 'minted', header: t('statistics_reports_0025'), accessorKey: 'totalMinted' as const, cell: (_: unknown, row: { totalMinted: number; tokenSymbol: string }) => `${row.totalMinted || '-'} ${row.tokenSymbol}` },
    { id: 'melted', header: t('statistics_reports_0024'), accessorKey: 'totalMelted' as const, cell: (_: unknown, row: { totalMelted: number; tokenSymbol: string }) => `${row.totalMelted || '-'} ${row.tokenSymbol}` },
    { id: 'sp', header: t('statistics_reports_0003'), accessorKey: 'serviceProviders' as const },
    { id: 'wallets', header: t('statistics_reports_0004'), accessorKey: 'wallets' as const },
    { id: 'status', header: t('statistics_reports_0017'), accessorKey: 'tokenStatus' as const, cell: (_: unknown, row: { tokenStatus: number }) => row.tokenStatus === 1 ? 'Active' : 'Inactive' },
  ] : [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'todoId' as const, cell: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { id: 'tokenName', header: t('statistics_reports_0023'), accessorKey: 'tokenName' as const },
    { id: 'tokenPrice', header: t('statistics_reports_0022'), accessorKey: 'tokenPrice' as const, cell: (_: unknown, row: { tokenSymbol: string; currencySymbol: string }) => `1 ${row.tokenSymbol} = 1 ${row.currencySymbol}` },
    { id: 'blockchain', header: t('statistics_reports_0021'), accessorKey: 'blockchain' as const },
    { id: 'circulation', header: t('statistics_reports_0020'), accessorKey: 'stablecoinsInCirculation' as const, cell: (_: unknown, row: { stablecoinsInCirculation: number; tokenSymbol: string }) => `${row.stablecoinsInCirculation || '-'} ${row.tokenSymbol}` },
    { id: 'minted', header: t('statistics_reports_0019'), accessorKey: 'totalMinted' as const, cell: (_: unknown, row: { totalMinted: number; tokenSymbol: string }) => `${row.totalMinted || '-'} ${row.tokenSymbol}` },
    { id: 'melted', header: t('statistics_reports_0018'), accessorKey: 'totalMelted' as const, cell: (_: unknown, row: { totalMelted: number; tokenSymbol: string }) => `${row.totalMelted || '-'} ${row.tokenSymbol}` },
    { id: 'sp', header: t('statistics_reports_0003'), accessorKey: 'serviceProviders' as const },
    { id: 'wallets', header: t('statistics_reports_0004'), accessorKey: 'wallets' as const },
    { id: 'status', header: t('statistics_reports_0017'), accessorKey: 'tokenStatus' as const, cell: (_: unknown, row: { tokenStatus: number }) => row.tokenStatus === 1 ? t('statistics_reports_0015') : t('statistics_reports_0016') },
  ];

  const tabs: TabItem[] = (tokenTypes || []).filter(tt => tt.status === 1).map(tt => ({ key: tt.tokenTypeId, label: tt.tokenTypeName, children: null }));
  const currentTime = dayjs().format('MMM D, YYYY, HH:mm:ss [UTC]Z');

  return (
    <div>
      <Tabs items={tabs} defaultActiveKey={tokenTypeId} onChange={(k) => { setTokenTypeId(k); setSelectedCoin(''); }} />

      {/* Overview Cards */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold text-base">{isStablecoin ? t('statistics_reports_0006') : Number(tokenTypeId) === 20 ? t('statistics_reports_0045') : t('statistics_reports_0007')}</h3>
          {hasLimit(DOWNLOAD_PERMISSION) && <Button>{t('statistics_reports_0029')}</Button>}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {chartData.map((d, i) => (<StatisticsPieCard key={i} title={d.title} count={d.count} chartData={d.chartData} showChart={d.showChart !== false} />))}
        </div>
      </Card>

      {/* Activity Charts */}
      <Card className="mt-4">
        <h3 className="font-extrabold text-base mb-4">{isStablecoin ? t('statistics_reports_0008') : Number(tokenTypeId) === 20 ? t('statistics_reports_0046') : t('statistics_reports_0009')}</h3>
        <div className="flex gap-4 mb-4">
          <Select value={selectedCoin} onChange={(v) => setSelectedCoin(v as string)} options={coinOptions.map(c => ({ label: c.label, value: c.value }))} />
          <Select value={timeRange} onChange={(v) => handleTimeRange(v as string)} options={TIME_RANGE_OPTIONS.map(o => ({ label: o.label, value: o.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ChartBox title="New Wallets"><ResponsiveContainer width="100%" height={200}><LineChart data={walletChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#6366f1" /></LineChart></ResponsiveContainer></ChartBox>
          <ChartBox title="SP Transactions"><ResponsiveContainer width="100%" height={200}><BarChart data={spChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#6366f1" /><Bar dataKey="volume" fill="#8b5cf6" /></BarChart></ResponsiveContainer></ChartBox>
          <ChartBox title={`${selectedCoinObj?.label || ''} - Transaction Count`}><ResponsiveContainer width="100%" height={200}><LineChart data={abcCountChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="TopUp" stroke="#6366f1" /><Line type="monotone" dataKey="Transfer" stroke="#8b5cf6" /><Line type="monotone" dataKey="Withdrawal" stroke="#a78bfa" /></LineChart></ResponsiveContainer></ChartBox>
          <ChartBox title={`${selectedCoinObj?.label || ''} - Transaction Volume`}><ResponsiveContainer width="100%" height={200}><LineChart data={abcVolumeChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="TopUp" stroke="#6366f1" /><Line type="monotone" dataKey="Transfer" stroke="#8b5cf6" /><Line type="monotone" dataKey="Withdrawal" stroke="#a78bfa" /></LineChart></ResponsiveContainer></ChartBox>
        </div>
      </Card>

      {/* Data Table */}
      <Card className="mt-4">
        <h3 className="font-extrabold text-base mb-4">{isStablecoin ? t('statistics_reports_0010') : Number(tokenTypeId) === 20 ? t('statistics_reports_0047') : t('statistics_reports_0011')} ({t('statistics_reports_0034')} {currentTime})</h3>
        <DataTable columns={cols} data={(tokenList?.rows || []).map((r, i) => ({ ...r, id: String(r.stablecoinId || i) }))} pagination={{ ...pg, total: tokenList?.page?.total || 0 }} onPaginationChange={setPg} actions={[]} />
      </Card>
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border rounded-lg p-3"><div className="text-sm font-medium mb-2">{title}</div>{children}</div>;
}
