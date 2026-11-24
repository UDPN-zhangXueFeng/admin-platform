import type { ColumnDef } from '@tanstack/react-table';
import type { TokenJournalEntry, TxReconLogRespVo } from '@myorg/modules/td-admin/data-access';
import { CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { EMPTY_FIELD_VALUE, getDirectionKey, getTxTypeKey } from '../reconciliation.constants';
import { InfoItem } from '../info-item';
import { ReconciliationDrawerCard } from '../reconciliation-drawer-card';
import { formatAmount, formatReconTime, type Amount } from './format';

export type ReconTranslation = (key: string) => string;

export interface AmountBlock {
  amount?: Amount;
  count?: Amount;
  currency?: string | null;
  tokenSymbol?: string | null;
}

export function AmountLines({ amount, count, currency, tokenSymbol, nonZero }: AmountBlock & { nonZero?: boolean }) {
  const fiat = formatAmount(amount, { nonZero });
  const token = formatAmount(count, { nonZero });
  if (fiat === EMPTY_FIELD_VALUE && token === EMPTY_FIELD_VALUE) return EMPTY_FIELD_VALUE;
  return (
    <div className="tabular-nums leading-tight">
      {fiat !== EMPTY_FIELD_VALUE && <div>{fiat} {currency}</div>}
      {token !== EMPTY_FIELD_VALUE && <div className="text-xs text-muted-foreground">{token} {tokenSymbol}</div>}
    </div>
  );
}

export function hasOriginalData(data?: TxReconLogRespVo['originalEntry']) {
  return Boolean(data && (data.tranId || data.postingDate || data.entries?.length));
}

export function hasOnchainData(onchain?: TxReconLogRespVo['onchainDetails'], txHash?: string) {
  return Boolean(onchain && (onchain.hash || txHash || onchain.blockHeight || onchain.fromAddress || onchain.toAddress ||
    onchain.amount != null || onchain.tokenCount != null || onchain.txTime));
}

export function ReconInfo({ t, log, children }: { t: ReconTranslation; log: TxReconLogRespVo; children: React.ReactNode }) {
  const txTypeKey = getTxTypeKey(Number(log.txType));
  return (
    <ReconciliationDrawerCard title={t('reconciliation_0115')}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoItem label={t('reconciliation_0076')}>{formatReconTime(log.reconciliationTime)}</InfoItem>
        <InfoItem label={t('reconciliation_0133')}><CopyableEllipsisText value={log.reconciliationNo} copyLabel={t('common_copy')} showCopyIcon /></InfoItem>
        <InfoItem label={t('reconciliation_0055')}>{txTypeKey ? t(txTypeKey) : EMPTY_FIELD_VALUE}</InfoItem>
        <InfoItem label={t('reconciliation_0015')}><CopyableEllipsisText value={log.tranId || log.txHash} copyLabel={t('common_copy')} truncate="middle" showCopyIcon /></InfoItem>
        <InfoItem label={t('reconciliation_0047')}>{log.financeBookName || EMPTY_FIELD_VALUE}</InfoItem>
        <InfoItem label={t('reconciliation_0048')}><CopyableEllipsisText value={log.bookNo} copyLabel={t('common_copy')} showCopyIcon /></InfoItem>
        <InfoItem label={t('reconciliation_0032')}>{log.currencySymbol || EMPTY_FIELD_VALUE}</InfoItem>
        {children}
      </div>
    </ReconciliationDrawerCard>
  );
}

export function OnchainPanel({ t, log, posted }: { t: ReconTranslation; log: TxReconLogRespVo; posted?: AmountBlock }) {
  const chain = log.onchainDetails;
  const amount = posted && (posted.amount != null || posted.count != null) ? posted : {
    amount: chain?.amount, count: chain?.tokenCount, currency: log.currencySymbol, tokenSymbol: chain?.tokenSymbol,
  };
  return (
    <ReconciliationDrawerCard title={t('reconciliation_0117')}>
      {chain && hasOnchainData(chain, posted ? log.txHash : undefined) ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <InfoItem label={t('reconciliation_0118')}>{formatAmount(chain.blockHeight)}</InfoItem>
          <InfoItem label={t('reconciliation_0050')}><CopyableEllipsisText value={chain.fromAddress} copyLabel={t('common_copy')} truncate="middle" showCopyIcon /></InfoItem>
          <InfoItem label={t('reconciliation_0051')}><CopyableEllipsisText value={chain.toAddress} copyLabel={t('common_copy')} truncate="middle" showCopyIcon /></InfoItem>
          <InfoItem label={t('reconciliation_0040')}><AmountLines {...amount} /></InfoItem>
          <InfoItem label={t('reconciliation_0057')}>{formatReconTime(chain.txTime)}</InfoItem>
          <InfoItem label={t('reconciliation_0058')}><CopyableEllipsisText value={chain.hash || log.txHash} copyLabel={t('common_copy')} truncate="middle" showCopyIcon /></InfoItem>
        </div>
      ) : <p className="text-sm text-muted-foreground">{t('common_no_data')}</p>}
    </ReconciliationDrawerCard>
  );
}

type EntryRow = TokenJournalEntry & { id: string };

export function JournalTable({ t, entries, currency, kind, date, txHash }: {
  t: ReconTranslation;
  entries?: TokenJournalEntry[];
  currency?: string;
  kind: 'original' | 'posted' | 'suggested';
  date?: string | number;
  txHash?: string;
}) {
  const columns: ColumnDef<EntryRow>[] = [];
  if (kind !== 'suggested') columns.push({ id: 'date', header: t('reconciliation_0039'), cell: () => formatReconTime(date, kind === 'original') });
  columns.push(
    { accessorKey: 'direction', header: t('realTimeDebitCredit'), cell: ({ row }) => {
      const key = getDirectionKey(Number(row.original.direction));
      return key ? t(key) : EMPTY_FIELD_VALUE;
    } },
    { id: 'account', header: t('reconciliation_0016'), cell: ({ row: { original } }) =>
      [original.accountCode, original.accountName].filter(Boolean).join(' ') || EMPTY_FIELD_VALUE },
    { accessorKey: 'amount', header: t('reconciliation_0040'), cell: ({ row: { original } }) => (
      <AmountLines amount={original.amount} currency={currency} count={kind === 'suggested' ? undefined : original.tokenCount}
        tokenSymbol={original.tokenSymbol} />
    ) },
  );
  if (kind !== 'original') columns.push({ id: 'tx', header: t('reconciliation_0015'), cell: ({ row }) => (
    <CopyableEllipsisText value={kind === 'posted' ? txHash : row.original.transactionId} copyLabel={t('common_copy')} truncate="middle" showCopyIcon />
  ) });
  return (
    <DataTable columns={columns} data={(entries ?? []).map((entry, index) => ({ ...entry, id: String(index) }))}
      emptyMessage={t(kind === 'original' ? 'reconciliation_0116' : 'common_no_data')} />
  );
}
