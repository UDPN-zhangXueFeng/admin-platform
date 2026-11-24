'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, DrawerClose, DrawerFooter, Input, Label, Textarea } from '@myorg/shared/ui';
import { type TxReconLogRespVo, usePostTokenSuspenseMutation } from '@myorg/modules/td-admin/data-access';
import { DIRECTION, EMPTY_FIELD_VALUE } from '../reconciliation.constants';
import { ReconciliationDrawerCard } from '../reconciliation-drawer-card';
import { type AmountBlock, JournalTable, OnchainPanel, ReconInfo } from './drawer-fields';
import { formatAmount, localDateInput, suspenseTotals } from './format';

const MAX_CONTEXT = 200;

export function PostToSuspenseModalContent({ log, postedAmount, mismatchedAmount, reason, onClose }: {
  log: TxReconLogRespVo;
  postedAmount?: AmountBlock;
  mismatchedAmount?: AmountBlock;
  reason?: string;
  onClose: () => void;
}) {
  const t = useTranslations('modules.reconciliation');
  const [postDate, setPostDate] = useState(() => localDateInput(log.suspenseEntries?.postingDate ?? log.originalEntry?.postingDate));
  const [context, setContext] = useState('');
  const submitting = useRef(false);
  const { mutate, isPending } = usePostTokenSuspenseMutation();
  const entries = log.suggestedSuspenseEntries ?? [];
  const totals = suspenseTotals(entries, DIRECTION.DEBIT, DIRECTION.CREDIT);
  const postingDate = Date.parse(postDate + 'T00:00:00.000Z');
  const allowed = Boolean(log.reconciliationTxId && context.trim() && Number.isFinite(postingDate) && totals.balanced && totals.valid);
  const difference = formatAmount(mismatchedAmount?.amount, { places: 2 });
  const tokenDifference = formatAmount(mismatchedAmount?.count);

  function submit() {
    if (!allowed || submitting.current) return;
    submitting.current = true;
    mutate({ reconciliationTxId: log.reconciliationTxId, postingDate, exceptionContext: context.trim(), suspenseEntries: entries }, {
      onSuccess: () => {
        toast.success(t('reconciliation_0264'));
        onClose();
      },
      onError: (error) => toast.error(error.message || t('reconciliation_0122')),
      onSettled: () => { submitting.current = false; },
    });
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <ReconInfo t={t} log={log}>
          {reason && <div className="flex flex-col self-end rounded bg-destructive/10 p-2 text-sm font-semibold text-destructive">
            <span>{reason}</span>
            {difference !== EMPTY_FIELD_VALUE && <span>{difference} {mismatchedAmount?.currency ?? log.currencySymbol}</span>}
            {tokenDifference !== EMPTY_FIELD_VALUE && <span>({tokenDifference} {mismatchedAmount?.tokenSymbol})</span>}
          </div>}
        </ReconInfo>
        <ReconciliationDrawerCard title={t('reconciliation_0035')}>
          <JournalTable t={t} entries={log.originalEntry?.entries} date={log.originalEntry?.postingDate} currency={log.currencySymbol} kind="original" />
        </ReconciliationDrawerCard>
        <OnchainPanel t={t} log={log} posted={postedAmount} />
        <ReconciliationDrawerCard title={t('reconciliation_0095')}>
          <div className="space-y-3">
            <div className="max-w-72 space-y-1.5">
              <Label htmlFor="post-date">{t('reconciliation_0039')} <span className="text-destructive">*</span></Label>
              <Input id="post-date" type="date" value={postDate} required onChange={(event) => setPostDate(event.target.value)} />
            </div>
            <JournalTable t={t} entries={entries} currency={log.currencySymbol} kind="suggested" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
              <span>{t('reconciliation_0128')}: {totals.dr}</span>
              <span>{t('reconciliation_0129')}: {totals.cr}</span>
              <span className={totals.balanced ? 'text-success' : 'text-destructive'}>{t('reconciliation_0130')}: {totals.diff}</span>
            </div>
          </div>
        </ReconciliationDrawerCard>
        <div className="space-y-1.5">
          <Label htmlFor="exception-context">{t('reconciliation_0044')} <span className="text-destructive">*</span></Label>
          <Textarea id="exception-context" value={context} maxLength={MAX_CONTEXT} required rows={3}
            placeholder={t('reconciliation_0120')} onChange={(event) => setContext(event.target.value)} />
          <p className="text-right text-xs text-muted-foreground">{context.length}/{MAX_CONTEXT}</p>
        </div>
      </div>
      <DrawerFooter className="border-t">
        <DrawerClose asChild><Button variant="outline">{t('common_cancel')}</Button></DrawerClose>
        <Button onClick={submit} disabled={!allowed || isPending} aria-busy={isPending}>{t('PUB_Confirm')}</Button>
      </DrawerFooter>
    </>
  );
}
