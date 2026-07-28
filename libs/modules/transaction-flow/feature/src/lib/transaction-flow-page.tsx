'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import type { TxFlowItem } from '@myorg/modules/transaction-flow/data-access';
import { useTxFlowList } from '@myorg/modules/transaction-flow/data-access';

const ALL = 'all';
interface Filters { stablecoinId: string; tokenType: string; txFrom: string; txTo: string; txType: string; blockchainId: string; dateRange: [string, string] | []; txHash: string; }
const EMPTY: Filters = { stablecoinId: ALL, tokenType: ALL, txFrom: '', txTo: '', txType: ALL, blockchainId: ALL, dateRange: [], txHash: '' };

export function TransactionFlowPage() {
  const t = useTranslations('modules.transaction-flow'); const tc = useTranslations('common');
  const [pg, setPg] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: 10 });
  const form = useForm<Filters>({ defaultValues: EMPTY }); const fv = form.watch();
  const qf = React.useMemo(() => { const r: Record<string, unknown> = {}; if (fv.stablecoinId !== ALL) r.stablecoinId = fv.stablecoinId; if (fv.tokenType !== ALL) r.tokenType = fv.tokenType; if (fv.txFrom) r.txFrom = fv.txFrom; if (fv.txTo) r.txTo = fv.txTo; if (fv.txType !== ALL) r.txType = fv.txType; if (fv.blockchainId !== ALL) r.blockchainId = fv.blockchainId; if (fv.dateRange.length === 2) { r.txStartTime = fv.dateRange[0]; r.txEndTime = fv.dateRange[1]; } if (fv.txHash) r.txHash = fv.txHash; return r; }, [fv]);
  const { data, isLoading } = useTxFlowList(qf as never, pg.pageNum, pg.pageSize);

  const cols = [
    { id: 'name', header: t('transaction_flow_0018'), accessorKey: 'name' as const },
    { id: 'tokenType', header: t('transaction_flow_0020'), accessorKey: 'tokenType' as const, cell: ({ getValue }: { getValue: () => number }) => tc(`token_type_${getValue()}`) },
    { id: 'txFrom', header: t('transaction_flow_002'), accessorKey: 'txFrom' as const },
    { id: 'txTo', header: t('transaction_flow_006'), accessorKey: 'txTo' as const },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' as const },
    { id: 'txType', header: t('transaction_flow_004'), accessorKey: 'txType' as const, cell: ({ getValue }: { getValue: () => number }) => t(`td_transaction_type_${getValue()}`) },
    { id: 'txAmount', header: t('transaction_flow_005'), accessorKey: 'txAmount' as const, cell: ({ getValue, row }: { getValue: () => number; row: { original: TxFlowItem } }) => `${getValue() || '-'} ${row.original.symbol}` },
    { id: 'txTime', header: t('transaction_flow_003'), accessorKey: 'txTime' as const, cell: ({ getValue }: { getValue: () => string }) => new Date(Number(getValue())).toLocaleString() },
    { id: 'txHash', header: t('transaction_flow_007'), accessorKey: 'txHash' as const, cell: ({ getValue, row }: { getValue: () => string; row: { original: TxFlowItem } }) => { const h = getValue(); const url = row.original.browserUrl ? row.original.browserUrl + (row.original.blockchainCode?.toLowerCase() === 'tron' ? '#/transaction/' : 'tx/') + h : ''; return url ? <a href={url} target="_blank" rel="noreferrer" className="text-blue-600">{h}</a> : <span>{h}</span>; } },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="txHash" label={t('transaction_flow_007')} control={form.control} />
        <FormSelect name="stablecoinId" label={t('transaction_flow_0018')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} allValue={ALL} />
        <FormSelect name="tokenType" label={t('transaction_flow_0020')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} allValue={ALL} />
        <FormField name="txFrom" label={t('transaction_flow_002')} control={form.control} />
        <FormField name="txTo" label={t('transaction_flow_006')} control={form.control} />
        <FormSelect name="txType" label={t('transaction_flow_004')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} allValue={ALL} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} allValue={ALL} />
        <FormDatePicker name="dateRange" label={t('transaction_flow_003')} control={form.control} mode="range" />
      </div>
      <DataTable columns={cols} data={(data?.rows || []).map((r, i) => ({ ...r, id: r.txHash + i }))} pagination={{ ...pg, total: data?.page?.total || 0 }} onPaginationChange={setPg} isLoading={isLoading} actions={[]} />
    </div>
  );
}
