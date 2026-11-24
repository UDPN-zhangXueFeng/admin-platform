import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import {
  type TokenReconBasicDetailRespVo, type TxReconDetailRespVo,
  useTxInvestigationListQuery, useTxListQuery,
} from '@myorg/modules/td-admin/data-access';
import { QueryForm } from '../../query-form';
import { ReconciliationSection } from '../reconciliation-section';
import { DEFAULT_PAGE_SIZE, TD_TX_TYPE_VALUES, TOKEN_TYPE, TX_TYPE_VALUES, getReconStatusKey, getTxTypeKey } from '../reconciliation.constants';
import { dateBound } from './format';
import { RealTimeTable } from './paginated-table';
import { transactionColumns } from './transaction-columns';

const ALL = 'all';
const initial = {
  reconciliationDateStart: '', reconciliationDateEnd: '', keyword: '', txType: ALL,
  txStartTime: '', txEndTime: '', reconciliationStatus: ALL,
};

export function TransactionTab({ tab, active, tokenId, info, onOpen }: {
  tab: 'list' | 'investigation';
  active: boolean;
  tokenId: number;
  info?: TokenReconBasicDetailRespVo;
  onOpen: (modal: { row: TxReconDetailRespVo; kind: 'post' | 'log' }) => void;
}) {
  const t = useTranslations('modules.reconciliation');
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: initial });
  const [filter, setFilter] = useState(initial);
  const [page, setPage] = useState({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  const investigation = tab === 'investigation';
  const params = { ...page, filters: {
    tokenId,
    reconciliationDateStart: dateBound(filter.reconciliationDateStart),
    reconciliationDateEnd: dateBound(filter.reconciliationDateEnd, true),
    keyword: filter.keyword || undefined,
    txType: filter.txType === ALL ? undefined : Number(filter.txType),
    txStartTime: dateBound(filter.txStartTime),
    txEndTime: dateBound(filter.txEndTime, true),
    reconciliationStatus: filter.reconciliationStatus === ALL ? undefined : Number(filter.reconciliationStatus),
  } };
  const list = useTxListQuery(params, active && !investigation);
  const queue = useTxInvestigationListQuery(params, active && investigation);
  const result = investigation ? queue : list;
  const all = { label: t('PUB_All'), value: ALL };
  const types = [all];
  const allowedTypes = Number(info?.tokenType) === TOKEN_TYPE.STABLECOIN ? TX_TYPE_VALUES : TD_TX_TYPE_VALUES;
  for (const value of allowedTypes) {
    const key = getTxTypeKey(value);
    if (key) types.push({ value: String(value), label: t(key as never) });
  }
  const statuses = [all];
  for (const value of [2, 3, 5, 6]) {
    const key = getReconStatusKey(value);
    if (key) statuses.push({ value: String(value), label: t(key as never) });
  }
  function query(values: typeof initial) {
    if (page.pageNum === 1 && Object.keys(initial).every((key) => values[key as keyof typeof initial] === filter[key as keyof typeof initial])) {
      void result.refetch();
    } else {
      setFilter(values);
      setPage((previous) => ({ ...previous, pageNum: 1 }));
    }
  }

  if (!active) return null;

  return (
    <ReconciliationSection title={t(investigation ? 'reconciliation_0144' : 'reconciliation_0143')}>
      <form onSubmit={handleSubmit(query)} className="mb-4">
        <QueryForm variant="plain" queryType="submit" fields={[
          <FormDateRangePicker key="reconDates" startName="reconciliationDateStart" endName="reconciliationDateEnd"
            control={control} label={t('reconciliation_0137')} />,
          <FormField key="keyword" name="keyword" label={t('reconciliation_0138')} register={register('keyword')} />,
          <FormSelect key="txType" name="txType" control={control} label={t('reconciliation_0055')} options={types} />,
          <FormDateRangePicker key="txDates" startName="txStartTime" endName="txEndTime"
            control={control} label={t('reconciliation_0139')} />,
          <FormSelect key="status" name="reconciliationStatus" control={control} label={t('reconciliation_0136')} options={statuses} />,
        ]} onReset={() => reset(initial)} queryLabel={t('PUB_Query')} resetLabel={t('PUB_Reset')} />
      </form>
      <RealTimeTable columns={transactionColumns(t, info?.currencySymbol, onOpen)} rows={result.data?.rows ?? []}
        total={result.data?.page?.total ?? 0} loading={result.isFetching} error={result.isError} page={page} onPageChange={setPage} />
    </ReconciliationSection>
  );
}
