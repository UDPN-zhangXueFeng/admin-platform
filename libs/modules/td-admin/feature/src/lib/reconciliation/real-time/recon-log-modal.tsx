'use client';

import { useTranslations } from 'next-intl';
import { Button, Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, Skeleton } from '@myorg/shared/ui';
import { useTxReconLogQuery } from '@myorg/modules/td-admin/data-access';
import { ReconLogModalContent } from './recon-log-modal-content';

export interface RealTimeReconLogModalProps {
  open: boolean;
  reconciliationTxId?: number;
  onOpenChange: (open: boolean) => void;
}

export function RealTimeReconLogModal({ open, reconciliationTxId, onOpenChange }: RealTimeReconLogModalProps) {
  const t = useTranslations('modules.reconciliation');
  const { data, isLoading, isError } = useTxReconLogQuery(reconciliationTxId, open);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('reconciliation_0110')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('reconciliation_0115')}</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? <Skeleton className="h-48" /> : isError || (open && !data) ? (
            <p className="text-sm text-destructive" role="alert">{t('realTimeLoadError')}</p>
          ) : data ? <ReconLogModalContent log={data} /> : null}
        </div>
        <DrawerFooter>
          <DrawerClose asChild><Button variant="outline">{t('common_close')}</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
