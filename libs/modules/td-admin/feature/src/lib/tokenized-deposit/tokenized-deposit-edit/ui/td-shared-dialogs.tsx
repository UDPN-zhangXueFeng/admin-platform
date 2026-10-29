'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@myorg/shared/ui';

import { GenerateWalletModal } from '../generate-wallet-modal';
import { RigsecWalletModal } from '../rigsec-wallet-modal';
import type { useWalletManagement } from '../hooks/use-wallet-management';

type WalletSlice = ReturnType<typeof useWalletManagement>;

/**
 * 共享 Modals / AlertDialogs（add/edit 两个页面共用）：GenerateWallet keystore 密码
 * Modal、rigsec/fireblocks Hot/Cold Modal、覆盖钱包/提交双确认 AlertDialog。
 * 源: tokenized-deposit-form-content.tsx 964-1033（纯代码搬移）。
 */
export interface TdSharedDialogsProps {
  isModalOpen: boolean;
  onGenerateWalletCancel: () => void;
  onGenerateWalletSubmit: WalletSlice['setWalletInfo'];
  isRigsecModalOpen: boolean;
  modalInfo: WalletSlice['modalInfo'];
  walletAttribute: WalletSlice['walletAttribute'];
  walletAttributeOptions: WalletSlice['walletAttributeOptions'];
  rigsecConfirmLoading: boolean;
  tokenName: string | undefined;
  currentKeyService: WalletSlice['currentKeyService'];
  onWalletAttributeChange: WalletSlice['setWalletAttribute'];
  onRigsecCancel: () => void;
  onRigsecSubmit: WalletSlice['handleRigsecSubmit'];
  overwriteConfirm: { open: boolean; onOk: (() => void) | null };
  onOverwriteCancel: () => void;
  onOverwriteConfirm: () => void;
  submitConfirm: {
    open: boolean;
    onOk: (() => Promise<void> | void) | null;
  };
  onSubmitCancel: () => void;
  onSubmitConfirm: () => void;
}

export function TdSharedDialogs({
  isModalOpen,
  onGenerateWalletCancel,
  onGenerateWalletSubmit,
  isRigsecModalOpen,
  modalInfo,
  walletAttribute,
  walletAttributeOptions,
  rigsecConfirmLoading,
  tokenName,
  currentKeyService,
  onWalletAttributeChange,
  onRigsecCancel,
  onRigsecSubmit,
  overwriteConfirm,
  onOverwriteCancel,
  onOverwriteConfirm,
  submitConfirm,
  onSubmitCancel,
  onSubmitConfirm,
}: TdSharedDialogsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      {/* ── keystore 密码 Modal ── */}
      <GenerateWalletModal
        open={isModalOpen}
        onCancel={onGenerateWalletCancel}
        onSubmit={onGenerateWalletSubmit}
      />

      {/* ── rigsec/fireblocks Hot/Cold Modal ── */}
      <RigsecWalletModal
        open={isRigsecModalOpen}
        modalInfo={modalInfo}
        walletAttribute={walletAttribute}
        walletAttributeOptions={walletAttributeOptions}
        loading={rigsecConfirmLoading}
        tokenName={tokenName}
        currentKeyService={currentKeyService}
        onWalletAttributeChange={onWalletAttributeChange}
        onCancel={onRigsecCancel}
        onConfirm={onRigsecSubmit}
      />

      {/* ── 双确认 AlertDialog（覆盖钱包 / 提交）── */}
      <AlertDialog
        open={overwriteConfirm.open}
        onOpenChange={(next) => !next && onOverwriteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokenized_deposit_0137')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tokenized_deposit_0138')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onOverwriteCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onOverwriteConfirm}>
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={submitConfirm.open}
        onOpenChange={(next) => !next && onSubmitCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokenized_deposit_0116')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tokenized_deposit_0117')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onSubmitCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onSubmitConfirm}>
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
