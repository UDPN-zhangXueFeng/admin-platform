import { useTranslations } from 'next-intl';
import type { TxReconLogRespVo } from '@myorg/modules/td-admin/data-access';
import { DIRECTION, EMPTY_FIELD_VALUE, RECON_STATUS_TONE, getReconStatusKey } from '../reconciliation.constants';
import { InfoItem } from '../info-item';
import { ReconciliationDrawerCard } from '../reconciliation-drawer-card';
import { StatusBadge } from '../status-badge';
import { AmountLines, hasOnchainData, hasOriginalData, JournalTable, OnchainPanel, ReconInfo } from './drawer-fields';
import { formatReconTime } from './format';

export function ReconLogModalContent({ log }: { log: TxReconLogRespVo }) {
  const t = useTranslations('modules.reconciliation');
  const original = log.originalEntry;
  const chain = log.onchainDetails;
  const suspense = log.suspenseEntries;
  const status = Number(log.reconciliationStatus);
  const statusKey = getReconStatusKey(status);
  let reason: string | undefined;
  if (status === 3 || status === 5 || status === 6) {
    if (!hasOnchainData(chain)) reason = t('unmatched_type_1');
    else if (!hasOriginalData(original)) reason = t('unmatched_type_2');
    else if (suspense && (suspense.tranId || suspense.postingDate || suspense.exceptionContext || suspense.entries?.length)) reason = t('unmatched_type_3');
  }
  const statusText = statusKey ? t(statusKey as never) : EMPTY_FIELD_VALUE;
  let entries = original?.entries;
  if (Number(log.txType) === 10 && entries?.length) {
    const amount = entries[0].amount;
    entries = [
      { ...entries[0], direction: DIRECTION.DEBIT, accountCode: '2002', accountName: 'Stablecoin in Repository', amount },
      { ...entries[1], direction: DIRECTION.CREDIT, accountCode: '2003', accountName: 'Stablecoin in Circulation', amount },
    ];
  }
  return (
    <>
      <ReconInfo t={t} log={log}>
        <InfoItem label={t('reconciliation_0136')}>
          {statusKey ? <StatusBadge tone={RECON_STATUS_TONE[status]}>{reason ? `${statusText} (${reason})` : statusText}</StatusBadge> : statusText}
          <AmountLines amount={chain?.amount} count={chain?.tokenCount} currency={log.currencySymbol} tokenSymbol={chain?.tokenSymbol} />
        </InfoItem>
      </ReconInfo>
      <ReconciliationDrawerCard title={t('reconciliation_0035')}>
        <JournalTable t={t} entries={entries} date={original?.postingDate} currency={log.currencySymbol} kind="original" />
      </ReconciliationDrawerCard>
      <OnchainPanel t={t} log={log} />
      {Boolean(suspense?.entries?.length) && (
        <ReconciliationDrawerCard title={t('reconciliation_0119')}>
          <JournalTable t={t} entries={suspense?.entries} date={suspense?.postingDate} currency={log.currencySymbol} kind="posted" txHash={log.txHash} />
          {suspense?.exceptionContext && <InfoItem label={t('reconciliation_0044')}>{suspense.exceptionContext}</InfoItem>}
        </ReconciliationDrawerCard>
      )}
      {(suspense?.processedBy || suspense?.processedTime) && (
        <ReconciliationDrawerCard title={t('reconciliation_0109')}>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label={t('reconciliation_0131')}>{suspense.processedBy || EMPTY_FIELD_VALUE}</InfoItem>
            <InfoItem label={t('reconciliation_0132')}>{formatReconTime(suspense.processedTime)}</InfoItem>
          </div>
        </ReconciliationDrawerCard>
      )}
    </>
  );
}
