'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from '@myorg/shared/util-i18n';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { type TokenReconSummaryRespVo, useTokenListQuery } from '@myorg/modules/td-admin/data-access';
import { useBlockchainListQuery } from '@myorg/modules/td-admin/data-access/lib/blockchain/+queries/blockchain.queries';
import { useCurrencyListQuery } from '@myorg/modules/td-admin/data-access/lib/chart-of-accounts/+queries/chart-of-accounts.queries';
import { QueryForm } from '../query-form';
import { createRowActionsColumn } from '../row-actions';
import { DEFAULT_PAGE_SIZE, EMPTY_FIELD_VALUE } from './reconciliation.constants';
import { ReconciliationSection } from './reconciliation-section';
import { RealTimeAccess } from './real-time/access';
import { dateBound, formatReconTime } from './real-time/format';
import { useRealTimeTokenTypes } from './real-time/token-options';
import { RealTimeTable } from './real-time/paginated-table';
import { SummaryFilterSelect } from './real-time/summary-filter-select';

const ALL = 'all';
const initial = {
  tokenName: '', tokenType: ALL, blockchainId: ALL, financeBookName: '',
  bookNo: '', currencyCode: ALL, lastReconciliationDateStart: '', lastReconciliationDateEnd: '',
};

function optionsFromRows(rows: TokenReconSummaryRespVo[], chainIdsByName: ReadonlyMap<string, string>) {
  const chains = new Map<string, string>();
  const currencies = new Map<string, string>();
  for (const row of rows) {
    if (row.blockchainName) {
      const chainId = row.blockchainId ?? chainIdsByName.get(row.blockchainName);
      if (chainId != null) chains.set(String(chainId), row.blockchainName);
    }
    if (row.currencySymbol) currencies.set(row.currencyCode ?? row.currencySymbol, row.currencySymbol);
  }
  return {
    chains: Array.from(chains, ([value, label]) => ({ value, label })),
    currencies: Array.from(currencies, ([value, label]) => ({ value, label })),
  };
}

export function RealTimeListPage() {
  return <RealTimeAccess><TokenList /></RealTimeAccess>;
}

function TokenList() {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: initial });
  const [filter, setFilter] = useState(initial);
  const [page, setPage] = useState({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  const tokenTypes = useRealTimeTokenTypes();
  const { data: blockchains } = useBlockchainListQuery();
  const { data: currencies } = useCurrencyListQuery();
  const chainKey = filter.blockchainId === ALL ? undefined : Number(filter.blockchainId);
  const result = useTokenListQuery({ ...page, filters: {
    tokenName: filter.tokenName || undefined,
    tokenType: filter.tokenType === ALL ? undefined : Number(filter.tokenType),
    blockchainId: chainKey,
    financeBookName: filter.financeBookName || undefined,
    bookNo: filter.bookNo || undefined,
    currencyCode: filter.currencyCode === ALL ? undefined : filter.currencyCode,
    lastReconciliationDateStart: dateBound(filter.lastReconciliationDateStart),
    lastReconciliationDateEnd: dateBound(filter.lastReconciliationDateEnd, true),
  } });
  const rows = result.data?.rows ?? [];
  const chainIdsByName = new Map((blockchains ?? []).map(({ key, value }) => [value, String(key)]));
  const available = optionsFromRows(rows, chainIdsByName);
  const chainOptions = available.chains.length ? available.chains : (blockchains ?? []).flatMap(({ key, value, status }) =>
    key && value ? [{ value: String(key), label: value, disabled: status !== 1 }] : []);
  const currencyOptions = available.currencies.length ? available.currencies : (currencies ?? []).flatMap(({ key, value }) =>
    key && value ? [{ value: key, label: value }] : []);
  const all = { label: t('PUB_All'), value: ALL };
  const count = (value?: number) => value || EMPTY_FIELD_VALUE;
  const openDetail = (row: TokenReconSummaryRespVo, tab: 'list' | 'investigation') => {
    router.push(`/reconciliation/real-time/view?tokenId=${row.tokenId}&tab=${tab}`);
  };
  const columns: ColumnDef<TokenReconSummaryRespVo>[] = [
    { accessorKey: 'tokenName', header: t('reconciliation_0052') },
    { accessorKey: 'tokenType', header: t('reconciliation_0053'), cell: ({ row }) =>
      tokenTypes.find(({ tokenTypeId }) => Number(tokenTypeId) === Number(row.original.tokenType))?.tokenTypeName || EMPTY_FIELD_VALUE },
    { accessorKey: 'blockchainName', header: t('PUB_Blockchain') },
    { accessorKey: 'financeBookName', header: t('reconciliation_0077'), cell: ({ row }) => row.original.financeBookName || EMPTY_FIELD_VALUE },
    { accessorKey: 'bookNo', header: t('reconciliation_0048'), cell: ({ row }) => row.original.bookNo || EMPTY_FIELD_VALUE },
    { accessorKey: 'currencySymbol', header: t('reconciliation_0032') },
    { accessorKey: 'lastReconciliationTime', header: t('reconciliation_0076'), cell: ({ row }) => formatReconTime(row.original.lastReconciliationTime) },
    { accessorKey: 'matchedCount', header: t('reconciliation_0073'), cell: ({ row }) =>
      <span className="font-semibold text-success">{count(row.original.matchedCount)}</span> },
    { accessorKey: 'unmatchedCount', header: t('reconciliation_0074'), cell: ({ row }) =>
      <span className="font-semibold text-destructive">{count(row.original.unmatchedCount)}</span> },
    { accessorKey: 'actionedCount', header: t('reconciliation_0075'), cell: ({ row }) =>
      <span className="font-semibold text-primary">{count(row.original.actionedCount)}</span> },
    createRowActionsColumn({
      header: t('PUB_Action'),
      detail: { label: t('PUB_Detail'), onClick: (row) => openDetail(row, 'list') },
      menu: (row) => row.unmatchedCount > 0 ? [{
        label: t('reconciliation_0078'), onClick: (data) => openDetail(data, 'investigation'),
      }] : [],
    }),
  ];

  function query(values: typeof initial) {
    if (page.pageNum === 1 && Object.keys(initial).every((key) => values[key as keyof typeof initial] === filter[key as keyof typeof initial])) {
      void result.refetch();
    } else {
      setFilter(values);
      setPage((previous) => ({ ...previous, pageNum: 1 }));
    }
  }

  return (
    <div className="space-y-4">
      <ReconciliationSection title={t('reconciliation_0072')}>
        <form onSubmit={handleSubmit(query)}>
          <QueryForm
            variant="plain"
            queryType="submit"
            fields={[
              <FormField key="tokenName" name="tokenName" label={t('reconciliation_0052')} register={register('tokenName')} />,
              <SummaryFilterSelect key="tokenType" name="tokenType" control={control} label={t('reconciliation_0053')}
                options={[all, ...tokenTypes.map((item) => ({ value: String(item.tokenTypeId), label: item.tokenTypeName, disabled: item.status === 0 }))]} />,
              <SummaryFilterSelect key="blockchainId" name="blockchainId" control={control} label={t('PUB_Blockchain')} options={[all, ...chainOptions]} />,
              <FormField key="financeBookName" name="financeBookName" label={t('reconciliation_0047')} register={register('financeBookName')} />,
              <FormField key="bookNo" name="bookNo" label={t('reconciliation_0048')} register={register('bookNo')} />,
              <FormSelect key="currencyCode" name="currencyCode" control={control} label={t('reconciliation_0032')} options={[all, ...currencyOptions]} />,
              <FormDateRangePicker key="lastReconciliationDate" startName="lastReconciliationDateStart" endName="lastReconciliationDateEnd"
                control={control} label={t('reconciliation_0071')} />,
            ]}
            onReset={() => reset(initial)}
            queryLabel={t('PUB_Query')}
            resetLabel={t('PUB_Reset')}
          />
        </form>
      </ReconciliationSection>
      <RealTimeTable columns={columns} rows={rows} total={result.data?.page?.total ?? 0}
        loading={result.isFetching} error={result.isError} page={page} onPageChange={setPage} />
    </div>
  );
}
