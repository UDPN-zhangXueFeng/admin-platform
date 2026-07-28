'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCoinList, useStatistics, useTrendData, useTrendTzData } from '@myorg/modules/statistic-analysis/data-access';
import type { CoinData } from '@myorg/modules/statistic-analysis/data-access';

const RANGES = [{ key: '1', label: 'Last 7 Days', ms: 7 * 86400000 }, { key: '3', label: 'Last 14 Days', ms: 14 * 86400000 }, { key: '2', label: 'Last 30 Days', ms: 30 * 86400000 }];

export function StatisticAnalysisPage() {
  const t = useTranslations('modules.statistic-analysis'); const tc = useTranslations('common');
  const { data: coins } = useCoinList();
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [range1, setRange1] = React.useState(RANGES[0]);
  const [range2, setRange2] = React.useState(RANGES[0]);
  const now = React.useMemo(() => new Date(new Date().toLocaleDateString('en-US')).getTime(), []);
  const activeCoin = coins?.[activeIdx];
  const { data: stats } = useStatistics(activeCoin?.code || '');
  const { data: trend } = useTrendData(activeCoin?.code || '', String(now - range1.ms), String(now));
  const { data: trendTz } = useTrendTzData(activeCoin?.code || '', String(now - range2.ms), String(now));

  if (!coins?.length) return <div className="p-8 text-muted-foreground">No data available</div>;

  const statsItems = stats ? [
    stats.tokenType === 1 ? { label: t('statistic_analysis_0014'), value: stats.reserveBalance, unit: stats.currencySymbol } : null,
    stats.tokenType === 1 && stats.pledgeType === 1 ? { label: t('statistic_analysis_0015'), value: stats.repositoryBalance, unit: stats.symbol } : null,
    { label: t('statistic_analysis_0016').replace('****', stats.symbol), value: stats.circulation, unit: stats.symbol },
    { label: stats.tokenType === 1 && stats.pledgeType === 1 ? tc('stablecoin_manage_021') : t('statistic_analysis_0006'), value: stats.totalMint, unit: stats.symbol },
    { label: stats.tokenType === 1 && stats.pledgeType === 1 ? tc('stablecoin_manage_023') : t('statistic_analysis_0007'), value: stats.totalMelt, unit: stats.symbol },
    { label: t('statistic_analysis_0013'), value: stats.walletNumber, unit: '' },
  ].filter(Boolean) : [];

  const trendChart = (trend || []).map(d => ({ date: new Date(Number(d.statisticsDay)).toLocaleDateString(), wallets: d.walletNumber, newWallets: d.walletNewNumber }));
  const trendTzChart = (trendTz || []).map(d => ({ date: new Date(Number(d.statisticsDay)).toLocaleDateString(), topUp: d.topUpTotal, transfer: d.transferTotal, withdrawal: d.withdrawalTotal }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-white p-1 border rounded-md max-w-[90%]">
        {coins.map((c: CoinData, i: number) => (
          <div key={i} className={`px-4 cursor-pointer py-2 rounded-md flex items-center ${activeIdx === i ? 'text-indigo-600 bg-indigo-100' : ''}`} onClick={() => setActiveIdx(i)}>
            <Image src={`/stablecoin/images/token_type_${c.tokenType}.svg`} alt="" width={20} height={20} className="mr-1" />
            {c.name}
            <span className="ml-2 text-white px-1 text-xs rounded-sm" style={{ background: tc(`blockchain_code_color_${c.blockchainNameAbbreviation}`) }}>{c.blockchainNameAbbreviation}</span>
          </div>
        ))}
      </div>

      <div className="bg-white shadow-lg rounded-xl p-4 mb-6">
        <h3 className="font-extrabold mb-6">{activeCoin?.name} {t('statistic_analysis_0023')}</h3>
        <div className="flex justify-around">
          {statsItems.map((item: { label: string; value: number; unit: string } | null, i: number) => item && (
            <div key={i} className="flex flex-col items-center">
              <Image src={`/stablecoin/images/${['reserve-account','balance-cbc','circulation','total-mint','total-melt','hsb-wallet'][i]}.${i === 2 ? 'svg' : 'jpg'}`} alt="" width={64} height={64} />
              <span className="text-sm text-gray-400 my-2">{item.label}</span>
              <span className="font-bold">{(item.value || 0)} {item.unit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-4 mb-6">
        <div className="flex justify-between mb-4">
          <h3 className="font-extrabold">{t('statistic_analysis_0011')}</h3>
          <select value={range1.key} onChange={(e) => setRange1(RANGES.find(r => r.key === e.target.value) || RANGES[0])}>
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={trendChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="wallets" fill="#6366f1" name={t('statistic_analysis_0013')} /><Bar dataKey="newWallets" fill="#8b5cf6" name={t('statistic_analysis_0017')} /></BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-4">
        <div className="flex justify-between mb-4">
          <h3 className="font-extrabold">{activeCoin?.name} {t('statistic_analysis_0025')}</h3>
          <select value={range2.key} onChange={(e) => setRange2(RANGES.find(r => r.key === e.target.value) || RANGES[0])}>
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendTzChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="topUp" stroke="#6366f1" name={t('statistic_analysis_0018')} /><Line type="monotone" dataKey="transfer" stroke="#8b5cf6" name={t('statistic_analysis_0019')} /><Line type="monotone" dataKey="withdrawal" stroke="#a78bfa" name={t('statistic_analysis_0020')} /></LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
