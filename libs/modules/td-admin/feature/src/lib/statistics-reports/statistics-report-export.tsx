'use client';

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from 'recharts';
import { formatDate, formatAdminDateTime } from '@myorg/shared/util-dates';
import {
  fetchStablecoinsOverview,
  fetchStablecoinList,
  fetchTdList,
  fetchWalletQuantity,
  fetchSpTransaction,
  fetchAbcTransactionCount,
  fetchAbcTransactionVolume,
} from '@myorg/modules/td-admin/data-access/lib/statistics-reports/statistics-reports.api';
import type {
  TokenListItem,
  StablecoinCoin,
  WalletQuantityItem,
  SpTransactionItem,
  AbcTransactionCountItem,
  AbcTransactionVolumeItem,
} from '@myorg/modules/td-admin/data-access/lib/statistics-reports/statistics-reports.model';
import { formatAmount, toChartDate } from './statistics-reports.utils';

type ReportOptions = {
  tokenTypeId: string;
  dateRange: [number, number];
  locale: string;
  messages: Record<string, string>;
};
type CoinReport = {
  coin: StablecoinCoin;
  wallets: WalletQuantityItem[];
  providers: SpTransactionItem[];
  counts: AbcTransactionCountItem[];
  volumes: AbcTransactionVolumeItem[];
};
const COLORS = ['#6366f1', '#16a34a', '#d97706', '#db2777', '#0891b2'];


function amount(value: string | number | null | undefined, symbol: string) {
  return `${formatAmount(value)} ${symbol}`;
}

function CoinCharts({ report, messages }: { report: CoinReport; messages: ReportOptions['messages'] }) {
  const m = (key: string) => messages[key];
  const dateAxis = <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={30} />;
  const grid = <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />;
  const walletData = report.wallets.map(row => ({ date: toChartDate(row.time), value: Number(row.numberOfNewWallets) }));
  const providerData = report.providers.map(row => ({ date: row.spName, count: Number(row.transactionCount), volume: Number(row.transactionVolume) }));
  const series = [
    { key: 'topUp', name: m('topUp') },
    { key: 'transfer', name: m('transfer') },
    { key: 'withdrawal', name: m('withdrawal') },
  ];
  const counts = report.counts.map(row => ({ date: toChartDate(row.time), topUp: Number(row.topUpCount), transfer: Number(row.transferCount), withdrawal: Number(row.withdrawalCount) }));
  const volumes = report.volumes.map(row => ({ date: toChartDate(row.time), topUp: Number(row.topUpVolume ?? row.topUpCount), transfer: Number(row.transferVolume ?? row.transferCount), withdrawal: Number(row.withdrawalVolume ?? row.withdrawalCount) }));
  return <div className="charts">
    <section><h3>{m('statistics_reports_0037')}</h3>{walletData.length ? <BarChart width={460} height={230} data={walletData}>{grid}{dateAxis}<YAxis width={60} /><Bar dataKey="value" name={m('statistics_reports_0038')} fill={COLORS[1]} isAnimationActive={false} /></BarChart> : <p>{m('statistics_reports_0043')}</p>}</section>
    {(['count', 'volume'] as const).map(metric => <section key={metric}><h3>{m('statistics_reports_0039')} — {m(metric === 'count' ? 'statistics_reports_0035' : 'statistics_reports_0036')}{metric === 'volume' ? ` (${report.coin.symbol})` : ''}</h3>{providerData.length ? <BarChart width={460} height={230} data={providerData}>{grid}{dateAxis}<YAxis width={80} /><Bar dataKey={metric} fill={COLORS[metric === 'count' ? 0 : 1]} isAnimationActive={false} /></BarChart> : <p>{m('statistics_reports_0043')}</p>}</section>)}
    {[{ data: counts, key: 'statistics_reports_0040', unit: '' }, { data: volumes, key: 'statistics_reports_0041', unit: report.coin.symbol }].map(chart => <section key={chart.key}><h3>{report.coin.name} {m(chart.key)} {chart.unit && `(${chart.unit})`}</h3>{chart.data.length ? <LineChart width={460} height={230} data={chart.data}>{grid}{dateAxis}<YAxis width={80} /><Legend />{series.map((item, index) => <Line key={item.key} dataKey={item.key} name={item.name} stroke={COLORS[index]} dot={false} isAnimationActive={false} />)}</LineChart> : <p>{m('statistics_reports_0043')}</p>}</section>)}
  </div>;
}

function ReportTable({ rows, stablecoin, messages }: { rows: TokenListItem[]; stablecoin: boolean; messages: ReportOptions['messages'] }) {
  const m = (key: string) => messages[key];
  const headers = ['index', 'statistics_reports_0023', 'statistics_reports_0022', 'statistics_reports_0021', ...(stablecoin ? ['statistics_reports_0028', 'statistics_reports_0027', 'statistics_reports_0026', 'statistics_reports_0025', 'statistics_reports_0024'] : ['statistics_reports_0020', 'statistics_reports_0019', 'statistics_reports_0018']), 'statistics_reports_0003', 'statistics_reports_0004', 'statistics_reports_0017'];
  return <table><thead><tr>{headers.map(key => <th key={key}>{m(key)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.stablecoinId}>
    <td>{row.todoId ?? index + 1}</td><td>{row.tokenName}</td><td>1 {row.tokenSymbol} = 1 {row.currencySymbol}</td><td>{row.blockchain}</td>
    {stablecoin && <><td>{amount(row.reserveAccount, row.currencySymbol)}</td><td>{amount(row.repositoryBalance, row.tokenSymbol)}</td></>}
    <td>{amount(row.stablecoinsInCirculation, row.tokenSymbol)}</td><td>{amount(row.totalMinted, row.tokenSymbol)}</td><td>{amount(row.totalMelted, row.tokenSymbol)}</td><td>{row.serviceProviders}</td><td>{row.wallets}</td><td>{m(Number(row.tokenStatus) === 1 ? 'statistics_reports_0015' : 'statistics_reports_0016')}</td>
  </tr>)}</tbody></table>;
}

/** Opens synchronously from the click event; fetches the whole type, not the current page/coin. */
export async function downloadStatisticsReport({ tokenTypeId, dateRange, locale, messages }: ReportOptions): Promise<void> {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error(messages['popupBlocked']);
  const root = createRoot(popup.document.body);
  popup.addEventListener('pagehide', () => root.unmount(), { once: true });
  const m = (key: string) => messages[key];
  popup.document.documentElement.lang = locale;
  popup.document.title = 'statistics-report';
  flushSync(() => root.render(<p>{m('preparingReport')}</p>));
  try {
    const [overview, coins, rows] = await Promise.all([
      fetchStablecoinsOverview(tokenTypeId), fetchStablecoinList(tokenTypeId), fetchTdList(tokenTypeId),
    ]);
    const reports: CoinReport[] = [];
    // Gateway advertises 20 requests/s. Four series per coin, at most 16/s.
    for (const coin of coins) {
      if (popup.closed) return;
      const startedAt = Date.now();
      const params = { tokenId: String(coin.stablecoinId), startTime: dateRange[0], endTime: dateRange[1] };
      const [wallets, providers, counts, volumes] = await Promise.all([
        fetchWalletQuantity(params), fetchSpTransaction(params), fetchAbcTransactionCount(params), fetchAbcTransactionVolume(params),
      ]);
      reports.push({ coin, wallets, providers, counts, volumes });
      const remaining = 250 - (Date.now() - startedAt);
      if (remaining > 0) {
        const { promise, resolve } = Promise.withResolvers<void>();
        window.setTimeout(resolve, remaining);
        await promise;
      }
    }
    if (popup.closed) return;
    const stablecoin = Number(tokenTypeId) === 1;
    const overviewKey = stablecoin ? 'statistics_reports_0006' : Number(tokenTypeId) === 20 ? 'statistics_reports_0045' : 'statistics_reports_0007';
    const overviewCards = overview ? [
      { title: m(stablecoin ? 'statistics_reports_0001' : Number(tokenTypeId) === 20 ? 'statistics_reports_0047' : 'statistics_reports_0002'), count: overview.stablecoinsCount, data: [] },
      { title: m('statistics_reports_0003'), count: overview.serviceProvidersCount, data: overview.serviceProvidersProportion },
      { title: m('statistics_reports_0004'), count: overview.walletsCount, data: overview.walletsProportion },
      { title: m('statistics_reports_0005'), count: overview.transactionCount, data: overview.transactionCountProportion },
    ] : [];
    const style = popup.document.createElement('style');
    style.textContent = `@page{size:A4 landscape;margin:12mm}body{font:13px Arial,"Heiti SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;color:#172033;margin:24px}h1{font-size:24px}h2{font-size:19px}h3{font-size:13px}header{margin-bottom:20px}.overview{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.overview section,.charts section{border:1px solid #cbd5e1;border-radius:6px;padding:12px}.overview strong{font-size:24px}.overview ul{padding-left:18px;font-size:11px}.coin,.table-section{break-before:page}.charts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.charts section{break-inside:avoid;min-height:260px}.charts svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:10px}th,td{padding:7px;border:1px solid #cbd5e1;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}button{padding:8px 16px;cursor:pointer}@media print{body{margin:0}.print-action{display:none}}`;
    popup.document.head.append(style);
    flushSync(() => root.render(<>
      <button className="print-action" onClick={() => popup.print()}>{m('printReport')}</button>
      <header><h1>{m(overviewKey)}</h1><p>{formatDate(dateRange[0], 'yyyy-MM-dd')} {m('statistics_reports_0044')} {formatDate(dateRange[1], 'yyyy-MM-dd')}</p><p>{m('statistics_reports_0034')} {formatAdminDateTime(new Date())}</p></header>
      {!overview && <p>{m('statistics_reports_0043')}</p>}
      <div className="overview">{overviewCards.map(card => <section key={card.title}><h2>{card.title}</h2><strong>{card.count}</strong>{!!card.data?.length && <><PieChart width={200} height={160}><Pie data={card.data.map(row => ({ name: row.tokenName, value: Number(row.count) }))} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65} isAnimationActive={false}>{card.data.map((row, index) => <Cell key={row.tokenName} fill={COLORS[index % COLORS.length]} />)}</Pie></PieChart><ul>{card.data.map(row => <li key={row.tokenName}>{row.tokenName}: {row.count}</li>)}</ul></>}</section>)}</div>
      {reports.map(report => <article className="coin" key={report.coin.stablecoinId}><h2>{report.coin.name} ({report.coin.blockchainNameAbbreviation})</h2><CoinCharts report={report} messages={messages} /></article>)}
      <section className="table-section"><h2>{m(stablecoin ? 'statistics_reports_0010' : Number(tokenTypeId) === 20 ? 'statistics_reports_0047' : 'statistics_reports_0011')}</h2>{rows.length ? <ReportTable rows={rows} stablecoin={stablecoin} messages={messages} /> : <p>{m('statistics_reports_0043')}</p>}</section>
    </>));
    await popup.document.fonts.ready;
    const { promise, resolve } = Promise.withResolvers<void>();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    await promise;
    if (!popup.closed) {
      popup.focus();
      popup.print();
    }
  } catch (error) {
    root.unmount();
    popup.close();
    throw error;
  }
}
