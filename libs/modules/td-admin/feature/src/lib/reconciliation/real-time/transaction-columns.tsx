import type { ColumnDef } from '@tanstack/react-table';
import type { TxReconDetailRespVo } from '@myorg/modules/td-admin/data-access';
import { Button } from '@myorg/shared/ui';
import { EMPTY_FIELD_VALUE, RECON_STATUS_TONE, getReconStatusKey, getTxTypeKey } from '../reconciliation.constants';
import { StatusBadge } from '../status-badge';
import { AmountLines, type ReconTranslation } from './drawer-fields';
import { formatAmount, formatReconTime } from './format';

export function financeCount(row: TxReconDetailRespVo) {
  return row.financeCount ?? row.financeTokenAmount;
}

export function chainCount(row: TxReconDetailRespVo) {
  return row.chainCount ?? row.chainTokenAmount ?? row.tokenCount;
}

export function transactionColumns(t: ReconTranslation, currency: string | undefined,
  onOpen: (modal: { row: TxReconDetailRespVo; kind: 'post' | 'log' }) => void): ColumnDef<TxReconDetailRespVo>[] {
  return [
    { accessorKey: 'lastReconciliationTime', header: t('reconciliation_0076'), cell: ({ row }) => formatReconTime(row.original.lastReconciliationTime) },
    { accessorKey: 'reconciliationNo', header: t('reconciliation_0133'), cell: ({ row }) => row.original.reconciliationNo || EMPTY_FIELD_VALUE },
    { accessorKey: 'txType', header: t('reconciliation_0055'), cell: ({ row }) => {
      const key = getTxTypeKey(Number(row.original.txType));
      return key ? t(key as never) : EMPTY_FIELD_VALUE;
    } },
    { accessorKey: 'tranId', header: t('reconciliation_0015'), cell: ({ row }) => row.original.tranId || row.original.txHash || EMPTY_FIELD_VALUE },
    { accessorKey: 'financeTxTime', header: t('reconciliation_0039'), cell: ({ row }) => formatReconTime(row.original.financeTxTime) },
    { id: 'financeAmount', header: t('reconciliation_0134'), cell: ({ row: { original } }) => (
      <AmountLines amount={original.financeAmount} count={financeCount(original)} currency={original.currencyCode ?? currency}
        tokenSymbol={original.tokenSymbol} nonZero />
    ) },
    { accessorKey: 'blockHeight', header: t('reconciliation_0118'), cell: ({ row }) => formatAmount(row.original.blockHeight) },
    { accessorKey: 'chainTxTime', header: t('reconciliation_0057'), cell: ({ row }) => formatReconTime(row.original.chainTxTime) },
    { id: 'chainAmount', header: t('reconciliation_0135'), cell: ({ row: { original } }) => (
      <AmountLines amount={original.chainAmount} count={chainCount(original)} currency={original.currencyCode ?? currency}
        tokenSymbol={original.tokenSymbol} nonZero />
    ) },
    { accessorKey: 'reconciliationStatus', header: t('reconciliation_0136'), cell: ({ row }) => {
      const status = Number(row.original.reconciliationStatus);
      const key = getReconStatusKey(status);
      return key ? <StatusBadge tone={RECON_STATUS_TONE[status]}>{t(key as never)}</StatusBadge> : EMPTY_FIELD_VALUE;
    } },
    { id: 'actions', header: t('PUB_Action'), meta: { stickyRight: true }, cell: ({ row: { original } }) => {
      const canPost = Number(original.reconciliationStatus) === 3 && original.canPostSuspense === true;
      return (
        <Button variant="ghost" size="sm" className="text-primary" onClick={() => onOpen({ row: original, kind: canPost ? 'post' : 'log' })}>
          {t(canPost ? 'reconciliation_0095' : 'realTimeReconLog')}
        </Button>
      );
    } },
  ];
}
