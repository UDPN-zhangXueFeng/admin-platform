'use client';

import { useTranslations } from 'next-intl';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, Skeleton } from '@myorg/shared/ui';
import { useTxReconLogQuery } from '@myorg/modules/td-admin/data-access';
import { getUnmatchedTypeKey } from '../reconciliation.constants';
import { hasOnchainData, hasOriginalData, type AmountBlock } from './drawer-fields';
import { PostToSuspenseModalContent } from './post-to-suspense-modal-content';

export interface PostToSuspenseModalProps {
  open: boolean;
  reconciliationTxId?: number;
  unmatchedType?: number;
  postedAmount?: AmountBlock;
  mismatchedAmount?: AmountBlock;
  onOpenChange: (open: boolean) => void;
}

export function PostToSuspenseModal({ open, reconciliationTxId, unmatchedType, postedAmount, mismatchedAmount, onOpenChange }: PostToSuspenseModalProps) {
  const t = useTranslations('modules.reconciliation');
  const { data: log, isLoading, isError } = useTxReconLogQuery(reconciliationTxId, open);
  let type = unmatchedType;
  if (log) {
    if (!hasOriginalData(log.originalEntry)) type = 2;
    else if (!hasOnchainData(log.onchainDetails, log.txHash)) type = 1;
    else if (log.suggestedSuspenseEntries?.length) type = 3;
  }
  const key = getUnmatchedTypeKey(type);
  const reason = key ? t(key as never) : undefined;
  const title = t('reconciliation_0095');
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{reason ? `${title} – ${reason}` : title}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('reconciliation_0115')}</DrawerDescription>
        </DrawerHeader>
        {isLoading ? <Skeleton className="m-4 h-48" /> : isError || (open && !log) ? (
          <p className="p-4 text-sm text-destructive" role="alert">{t('realTimeLoadError')}</p>
        ) : open && log ? (
          <PostToSuspenseModalContent key={reconciliationTxId} log={log} reason={reason} postedAmount={postedAmount}
            mismatchedAmount={mismatchedAmount} onClose={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
