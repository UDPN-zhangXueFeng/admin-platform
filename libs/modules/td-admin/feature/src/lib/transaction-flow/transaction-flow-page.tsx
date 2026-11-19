'use client';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import type { TxFlowItem } from '@myorg/modules/td-admin/data-access';
import {
  useBlockchainListQuery,
  useStablecoinsQuery,
  useTokenTypeListQuery,
  useTxFlowList,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';

const ALL = 'all';
type TxRow = TxFlowItem & { id: string };
interface Filters { stablecoinId: string; tokenType: string; txFrom: string; txTo: string; txType: string; blockchainId: string; txStartTime: string; txEndTime: string; txHash: string; }
const EMPTY: Filters = { stablecoinId: ALL, tokenType: ALL, txFrom: '', txTo: '', txType: ALL, blockchainId: ALL, txStartTime: '', txEndTime: '', txHash: '' };
/** Transaction type filter values（对齐旧页 stablecoin.tsx:85-99）。 */
const TX_TYPE_CODES = [1, 2, 3, 4, 5, 6, 9, 10, 12, 13, 16, 17, 18];

export function TransactionFlowPage() {
  const t = useTranslations('modules.transaction-flow'); const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const initialStablecoinId = searchParams.get('stablecoinId') || ALL;
  // journal-entries 深链带 ?txHash=，进入页面即预填（与 stablecoinId 并存）。
  const initialTxHash = searchParams.get('txHash') || '';
  const { data: stablecoins } = useStablecoinsQuery();
  const { data: tokenTypes } = useTokenTypeListQuery();
  const { data: blockchains } = useBlockchainListQuery();
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 });
  const form = useForm<Filters>({ defaultValues: { ...EMPTY, stablecoinId: initialStablecoinId, txHash: initialTxHash } }); const fv = form.watch();
  const { setValue } = form;
  React.useEffect(() => {
    setValue('stablecoinId', initialStablecoinId);
    setValue('txHash', initialTxHash);
    setPg((previous) => previous.pageNum === 1 ? previous : { ...previous, pageNum: 1 });
  }, [initialStablecoinId, initialTxHash, setValue]);
  const stablecoinOptions = [
    { label: tc('PUB_All'), value: ALL },
    ...(stablecoins ?? [])
      .filter((coin) => coin.stablecoinId != null)
      .map((coin) => ({ label: coin.name ?? String(coin.stablecoinId), value: String(coin.stablecoinId) })),
  ];
  // tokenType 下拉：status=0 的项置灰（对齐旧 useTokenTypeOptions）。
  const tokenTypeOptions: Array<{ label: string; value: string; disabled?: boolean }> = [
    { label: tc('PUB_All'), value: ALL },
    ...(tokenTypes ?? [])
      .filter((type) => type.tokenTypeId != null)
      .map((type) => ({ label: type.tokenTypeName ?? String(type.tokenTypeId), value: String(type.tokenTypeId), disabled: type.status === 0 })),
  ];
  const txTypeOptions = [
    { label: tc('PUB_All'), value: ALL },
    ...TX_TYPE_CODES.map((code) => ({ label: t(`td_transaction_type_${code}`), value: String(code) })),
  ];
  // 链下拉：status!==1 的链单项 disabled（对齐旧 blockchain/list 语义）。
  const blockchainOptions = (blockchains ?? []).filter((chain) => chain.key != null && chain.key !== '');
  const qf = React.useMemo(() => { const r: Record<string, unknown> = {}; if (fv.stablecoinId !== ALL) r.stablecoinId = fv.stablecoinId; if (fv.tokenType !== ALL) r.tokenType = Number(fv.tokenType); if (fv.txFrom) r.txFrom = fv.txFrom; if (fv.txTo) r.txTo = fv.txTo; if (fv.txType !== ALL) r.txType = Number(fv.txType); if (fv.blockchainId !== ALL) r.blockchainId = Number(fv.blockchainId); if (fv.txStartTime) r.txStartTime = fv.txStartTime; if (fv.txEndTime) r.txEndTime = fv.txEndTime; if (fv.txHash) r.txHash = fv.txHash; return r; }, [fv]);
  const { data, isLoading } = useTxFlowList(qf as never, pg.pageNum, pg.pageSize);

  const cols: ColumnDef<TxRow>[] = [
    { id: 'name', header: t('transaction_flow_0018'), accessorKey: 'name' },
    { id: 'tokenType', header: t('transaction_flow_0020'), accessorKey: 'tokenType', cell: ({ row }) => tc(`token_type_${row.original.tokenType}`) },
    { id: 'txFrom', header: t('transaction_flow_002'), accessorKey: 'txFrom' },
    { id: 'txTo', header: t('transaction_flow_006'), accessorKey: 'txTo' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'txType', header: t('transaction_flow_004'), accessorKey: 'txType', cell: ({ row }) => t(`td_transaction_type_${row.original.txType}`) },
    { id: 'txAmount', header: t('transaction_flow_005'), accessorKey: 'txAmount', cell: ({ row }) => `${row.original.txAmount || '-'} ${row.original.symbol}` },
    { id: 'txTime', header: t('transaction_flow_003'), accessorKey: 'txTime', cell: ({ row }) => formatAdminTimestamp(Number(row.original.txTime)) },
    { id: 'txHash', header: t('transaction_flow_007'), accessorKey: 'txHash', cell: ({ row }) => { const h = row.original.txHash; const url = row.original.browserUrl ? row.original.browserUrl + (row.original.blockchainCode?.toLowerCase() === 'tron' ? '#/transaction/' : 'tx/') + h : ''; return url ? <a href={url} target="_blank" rel="noreferrer" className="text-blue-600">{h}</a> : <span>{h}</span>; } },
  ];

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pg.pageNum,
      pageSize: pg.pageSize,
      total: data?.page?.total || 0,
      onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })),
      onPageSizeChange: (size: number) => setPg({ pageNum: 1, pageSize: size }),
    }),
    [pg.pageNum, pg.pageSize, data?.page?.total],
  );

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="txHash" label={t('transaction_flow_007')} register={form.register('txHash')} placeholder={t('transaction_flow_007')} />
        <FormSelect name="stablecoinId" label={t('transaction_flow_0018')} control={form.control} options={stablecoinOptions} placeholder={tc('PUB_All')} />
        {/* FormSelect 不透传单项 disabled，tokenType/blockchain 手写 Controller + Select。 */}
        <Controller
          control={form.control}
          name="tokenType"
          render={({ field }) => (
            <div>
              <label htmlFor="select-tokenType" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('transaction_flow_0020')}
              </label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="select-tokenType">
                  <SelectValue placeholder={tc('PUB_All')} />
                </SelectTrigger>
                <SelectContent>
                  {tokenTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <FormField name="txFrom" label={t('transaction_flow_002')} register={form.register('txFrom')} placeholder={t('transaction_flow_002')} />
        <FormField name="txTo" label={t('transaction_flow_006')} register={form.register('txTo')} placeholder={t('transaction_flow_006')} />
        <FormSelect name="txType" label={t('transaction_flow_004')} control={form.control} options={txTypeOptions} placeholder={tc('PUB_All')} />
        <Controller
          control={form.control}
          name="blockchainId"
          render={({ field }) => (
            <div>
              <label htmlFor="select-blockchainId" className="mb-1.5 block text-sm font-medium text-foreground">
                {tc('PUB_Blockchain')}
              </label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="select-blockchainId">
                  <SelectValue placeholder={tc('PUB_All')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tc('PUB_All')}</SelectItem>
                  {blockchainOptions.map((chain) => (
                    <SelectItem
                      key={String(chain.key)}
                      value={String(chain.key)}
                      disabled={chain.status !== 1}
                    >
                      {chain.value ?? String(chain.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <FormDateRangePicker startName="txStartTime" endName="txEndTime" control={form.control} label={t('transaction_flow_003')} />
      </div>
      <DataTable columns={cols} data={(data?.rows || []).map((r, i) => ({ ...r, id: r.txHash + i }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}
