'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination } from '@myorg/shared/ui';
import type { ProcessRecord, SuspiciousRuleDetail, SuspiciousTransactionItem } from '@myorg/modules/screening-monitoring/data-access';
import { useSuspiciousDetail, useSuspiciousTransactions } from '@myorg/modules/screening-monitoring/data-access';
import { ScreeningRiskLevelTag, ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;

export function TransactionMonitoringDetailPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter(); const sp = useSearchParams(); const id = Number(sp.get('id')); const bt = Number(sp.get('type'));
  const { data: detail, isLoading } = useSuspiciousDetail(id);
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { data: txData, isLoading: txLoading } = useSuspiciousTransactions({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: { suspiciousId: id } });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!detail) return <div className="p-8 text-muted-foreground">Transaction not found</div>;

  const isTimeSeries = bt === 40 || bt === 50;
  const basicItems = isTimeSeries ? [
    { l: t('screening_monitoring_0015'), v: detail.walletAddress }, { l: t('screening_monitoring_0001'), v: detail.stablecoinName, s: 2 }, { l: t('screening_monitoring_0002'), v: detail.businessName },
    { l: t('screening_monitoring_0019'), v: (bt === 50 || bt === 40) ? detail.description + '%' : (bt === 20 || bt === 30) ? detail.description + t('screening_monitoring_0081') : detail.description, s: 2 },
    { l: t('screening_monitoring_0058'), v: (detail.currentValue ?? '-') + ' ' + (detail.symbol ?? '') },
    { l: t('screening_monitoring_0059').replace('${day}', String(detail.compareToTime ?? '')), v: (detail.compareValue ?? '-') + ' ' + (detail.symbol ?? ''), s: 2 },
    { l: t('screening_monitoring_0016'), v: detail.monitorDate ? new Date(Number(detail.monitorDate)).toLocaleString() : '-' },
    { l: t('screening_monitoring_0011'), v: <ScreeningRiskLevelTag priority={detail.resultPriority} />, s: 2 },
    { l: tc('PUB_Status'), v: <ScreeningStatusBadge status={detail.state} variant="suspicious" />, s: 3 },
  ] : [
    { l: t('screening_monitoring_0015'), v: detail.walletAddress }, { l: t('screening_monitoring_0001'), v: detail.stablecoinName, s: 2 }, { l: t('screening_monitoring_0002'), v: detail.businessName },
    { l: t('screening_monitoring_0019'), v: detail.description, s: 2 },
    { l: t('screening_monitoring_0016'), v: detail.monitorDate ? new Date(Number(detail.monitorDate)).toLocaleString() : '-' },
    { l: t('screening_monitoring_0011'), v: <ScreeningRiskLevelTag priority={detail.resultPriority} />, s: 2 },
    { l: tc('PUB_Status'), v: <ScreeningStatusBadge status={detail.state} variant="suspicious" />, s: 3 },
  ];

  const timeSeriesCols: ColumnDef<SuspiciousTransactionItem>[] = [
    { id: 'txDate', header: t('screening_monitoring_0063'), accessorKey: 'transactionDate', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'txType', header: t('screening_monitoring_0002'), accessorKey: 'transactionType', cell: () => t('transaction_monitoring_type_4') + (bt === 40 ? t('screening_monitoring_0084') : t('screening_monitoring_0085')) },
    { id: 'txAmount', header: t('screening_monitoring_0068'), accessorKey: 'transactionAmount', cell: ({ getValue, row }) => (getValue<number>() ?? '-') + ' ' + (row.original.transactionUnit ?? '') },
  ];
  const transferCols: ColumnDef<SuspiciousTransactionItem>[] = [
    { id: 'from', header: t('screening_monitoring_0066'), accessorKey: 'from' },
    { id: 'to', header: t('screening_monitoring_0067'), accessorKey: 'to' },
    { id: 'txType2', header: t('screening_monitoring_0002'), accessorKey: 'transactionType', cell: ({ getValue }) => t(`transaction_monitoring_type_${getValue<number>()}`) },
    { id: 'txAmount2', header: t('screening_monitoring_0068'), accessorKey: 'transactionAmount', cell: ({ getValue, row }) => (getValue<number>() ?? '-') + ' ' + (row.original.transactionUnit ?? '') },
    { id: 'txDate2', header: t('screening_monitoring_0063'), accessorKey: 'transactionDate', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'txHash', header: t('screening_monitoring_0062'), accessorKey: 'transactionHash', cell: ({ getValue }) => { const v = getValue<string>(); return detail.browserUrl ? <a href={detail.browserUrl + 'tx/' + v} target="_blank" rel="noreferrer" className="text-blue-600">{v}</a> : v; } },
  ];

  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: txData?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })) }), [pg.pageNum, pg.pageSize, txData?.page?.total]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {basicItems.map((item, i) => (<div key={i} className={item.s && item.s > 1 ? `col-span-${item.s}` : ''}><dt className="text-sm text-muted-foreground">{item.l}</dt><dd className="text-sm font-medium mt-1">{item.v}</dd></div>))}
      </div>
      <DataTable columns={isTimeSeries ? timeSeriesCols : transferCols} data={(txData?.rows ?? []).map(r => ({ ...r, id: String(r.transactionDate || Math.random()) }))} pagination={tablePagination} isLoading={txLoading} />

      <div className="bg-white p-4 mt-8 font-bold">{t('screening_monitoring_0038')}</div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0000')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0041')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0010')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0011')}</th>
          </tr>
        </thead>
        <tbody>
          {(detail.ruleDetails || []).map((item: SuspiciousRuleDetail, i: number) => (
            <tr key={i} className="border-b">
              {i === 0 && <td className="py-2 pr-4 align-top" rowSpan={detail.ruleDetails?.length}>{detail.ruleName}</td>}
              <td className="py-2 pr-4">{item.minValue + (detail.unit === 2 ? ' % ' : '') + ' - ' + item.maxValue + (detail.unit === 2 ? ' % ' : '')}</td>
              <td className="py-2 pr-4">{item.riskScoring}</td>
              <td className="py-2 pr-4"><ScreeningRiskLevelTag priority={item.priority} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-white p-4 mt-8 font-bold">{t('screening_monitoring_0077')}</div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0075')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0074')}</th>
            <th className="py-2 pr-4 font-medium">{tc('PUB_Creater')}</th>
            <th className="py-2 pr-4 font-medium">{tc('PUB_CreateTime')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0062')}</th>
            <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0063')}</th>
            <th className="py-2 pr-4 font-medium">{tc('PUB_Status')}</th>
            <th className="py-2 pr-4 font-medium">{tc('PUB_Action')}</th>
          </tr>
        </thead>
        <tbody>
          {(detail.processList || []).map((row: ProcessRecord, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2 pr-4">{row.processResult === 1 ? t('transaction_monitoring_type_1') : t('transaction_monitoring_type_2')}</td>
              <td className="py-2 pr-4">{t(`suggested_action_type_${row.processingType}`)}</td>
              <td className="py-2 pr-4">{row.createdBy}</td>
              <td className="py-2 pr-4">{row.createdOn ? new Date(Number(row.createdOn)).toLocaleString() : '-'}</td>
              <td className="py-2 pr-4">{row.transactionHash || '--'}</td>
              <td className="py-2 pr-4">{row.transactionTime ? new Date(Number(row.transactionTime)).toLocaleString() : '--'}</td>
              <td className="py-2 pr-4"><span className={`text-xs ${tc(`approval_task_status_color_${row.status}`)}`}>{tc(`common_task_status_${row.status}`)}</span></td>
              <td className="py-2 pr-4"><button className="text-blue-600 cursor-pointer" onClick={() => router.push(`/approval-manage/view?id=${row.taskId}&busCode=${row.businessCode}`)}>{tc('PUB_Detail')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-center mt-6"><Button variant="outline" onClick={() => router.back()}>{tc('PUB_GoBack')}</Button></div>
    </div>
  );
}
