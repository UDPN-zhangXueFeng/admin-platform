'use client';

import { useTranslations } from 'next-intl';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@myorg/shared/ui';

export function WalletTypeSubmitDialog({ open, submitting, onClose, onConfirm }: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('modules.wallet');
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
          <AlertDialogDescription>{t('walletType.form.confirmContent')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={submitting} onClick={(event) => { event.preventDefault(); onConfirm(); }}>
            {t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
