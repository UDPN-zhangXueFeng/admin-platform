'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import type { TxFlowItem } from '@myorg/modules/transaction-flow/data-access';
import { useTxFlowList } from '@myorg/modules/transaction-flow/data-access';

const ALL = 'all';
type TxRow = TxFlowItem & { id: string };
interface Filters { stablecoinId: string; tokenType: string; txFrom: string; txTo: string; txType: string; blockchainId: string; txStartTime: string; txEndTime: string; txHash: string; }
const EMPTY: Filters = { stablecoinId: ALL, tokenType: ALL, txFrom: '', txTo: '', txType: ALL, blockchainId: ALL, txStartTime: '', txEndTime: '', txHash: '' };

export function TransactionFlowPage() {
  const t = useTranslations('modules.transaction-flow'); const tc = useTranslations('common');
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 });
  const form = useForm<Filters>({ defaultValues: EMPTY }); const fv = form.watch();
  const qf = React.useMemo(() => { const r: Record<string, unknown> = {}; if (fv.stablecoinId !== ALL) r.stablecoinId = fv.stablecoinId; if (fv.tokenType !== ALL) r.tokenType = fv.tokenType; if (fv.txFrom) r.txFrom = fv.txFrom; if (fv.txTo) r.txTo = fv.txTo; if (fv.txType !== ALL) r.txType = fv.txType; if (fv.blockchainId !== ALL) r.blockchainId = fv.blockchainId; if (fv.txStartTime) r.txStartTime = fv.txStartTime; if (fv.txEndTime) r.txEndTime = fv.txEndTime; if (fv.txHash) r.txHash = fv.txHash; return r; }, [fv]);
  const { data, isLoading } = useTxFlowList(qf as never, pg.pageNum, pg.pageSize);

  const cols: ColumnDef<TxRow>[] = [
    { id: 'name', header: t('transaction_flow_0018'), accessorKey: 'name' },
    { id: 'tokenType', header: t('transaction_flow_0020'), accessorKey: 'tokenType', cell: ({ row }) => tc(`token_type_${row.original.tokenType}`) },
    { id: 'txFrom', header: t('transaction_flow_002'), accessorKey: 'txFrom' },
    { id: 'txTo', header: t('transaction_flow_006'), accessorKey: 'txTo' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'txType', header: t('transaction_flow_004'), accessorKey: 'txType', cell: ({ row }) => t(`td_transaction_type_${row.original.txType}`) },
    { id: 'txAmount', header: t('transaction_flow_005'), accessorKey: 'txAmount', cell: ({ row }) => `${row.original.txAmount || '-'} ${row.original.symbol}` },
    { id: 'txTime', header: t('transaction_flow_003'), accessorKey: 'txTime', cell: ({ row }) => new Date(Number(row.original.txTime)).toLocaleString() },
    { id: 'txHash', header: t('transaction_flow_007'), accessorKey: 'txHash', cell: ({ row }) => { const h = row.original.txHash; const url = row.original.browserUrl ? row.original.browserUrl + (row.original.blockchainCode?.toLowerCase() === 'tron' ? '#/transaction/' : 'tx/') + h : ''; return url ? <a href={url} target="_blank" rel="noreferrer" className="text-blue-600">{h}</a> : <span>{h}</span>; } },
  ];

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pg.pageNum,
      pageSize: pg.pageSize,
      total: data?.page?.total || 0,
      onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })),
    }),
    [pg.pageNum, pg.pageSize, data?.page?.total],
  );

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="txHash" label={t('transaction_flow_007')} register={form.register('txHash')} placeholder={t('transaction_flow_007')} />
        <FormSelect name="stablecoinId" label={t('transaction_flow_0018')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} placeholder={tc('PUB_All')} />
        <FormSelect name="tokenType" label={t('transaction_flow_0020')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} placeholder={tc('PUB_All')} />
        <FormField name="txFrom" label={t('transaction_flow_002')} register={form.register('txFrom')} placeholder={t('transaction_flow_002')} />
        <FormField name="txTo" label={t('transaction_flow_006')} register={form.register('txTo')} placeholder={t('transaction_flow_006')} />
        <FormSelect name="txType" label={t('transaction_flow_004')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} placeholder={tc('PUB_All')} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL }]} placeholder={tc('PUB_All')} />
        <FormDatePicker name="txStartTime" label={t('transaction_flow_003')} control={form.control} placeholder={t('transaction_flow_003')} />
        <FormDatePicker name="txEndTime" label={t('transaction_flow_003')} control={form.control} placeholder={t('transaction_flow_003')} />
      </div>
      <DataTable columns={cols} data={(data?.rows || []).map((r, i) => ({ ...r, id: r.txHash + i }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}
