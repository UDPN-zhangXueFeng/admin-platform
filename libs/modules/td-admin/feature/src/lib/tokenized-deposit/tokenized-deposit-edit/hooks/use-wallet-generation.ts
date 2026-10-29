'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import { useGenerateWalletKeystoreMutation } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.mutations';
import type { KeyServiceOption, TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import type { BlockchainOption } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';

import type { ModalInfo, WalletRoleType } from './use-wallet-management';

/**
 * useWalletGeneration — 钱包生成 hook（checkWalletAddress 入口分流 +
 * keystore/rigsec 双路径生成 setWalletInfo / handleRigsecSubmit + rigsecConfirmLoading）。
 * 源: use-wallet-management.tsx 305-508（纯代码搬移；回调 deps 补充传入的稳定 setter）。
 */
export interface UseWalletGenerationParams {
  /** 主表单（含 blockchainId/name/钱包 3 角色 9 字段）。 */
  form: UseFormReturn<TDEditFormValues>;
  /** keystore 密码 Modal 表单（含 password）。 */
  form1: UseFormReturn<{ password?: string }>;
  /** 路由 code（存在=编辑态，影响 ifAdd）。 */
  code?: string | number;
  blockchainList?: BlockchainOption[];
  keyServiceList?: KeyServiceOption[];
  /** 当前 keyServiceName（form.keyServiceName）。 */
  keyServiceName?: string;
  /** 当前 chainType（edit 页 state）。 */
  chainType: string;
  modalInfo: ModalInfo;
  walletAttribute: number;
  defaultWalletAttribute: number;
  /** "已有钱包，确认覆盖"确认回调（调用方实现，内部触发 onOk）。 */
  confirmOverwrite: (onOk: () => void) => void;
  setModalInfo: (info: ModalInfo) => void;
  setIsModalOpen: (open: boolean) => void;
  setIsRigsecModalOpen: (open: boolean) => void;
  setWalletAttribute: (attr: number) => void;
}

export function useWalletGeneration({
  form,
  form1,
  code,
  blockchainList,
  keyServiceList,
  keyServiceName,
  chainType,
  modalInfo,
  walletAttribute,
  defaultWalletAttribute,
  confirmOverwrite,
  setModalInfo,
  setIsModalOpen,
  setIsRigsecModalOpen,
  setWalletAttribute,
}: UseWalletGenerationParams) {
  const [rigsecConfirmLoading, setRigsecConfirmLoading] = useState(false);

  const generateWalletMutation = useGenerateWalletKeystoreMutation();
  const t = useTranslations('modules.tokenized-deposit');

  // ── checkWalletAddress：分流 keystore / rigsec 生成入口 ──
  const checkWalletAddress = useCallback(
    (type: WalletRoleType) => {
      const walletAddressContractOwner = form.getValues(
        'walletAddressContractOwner',
      );
      const walletAddressPaymentOfGasFee = form.getValues(
        'walletAddressPaymentOfGasFee',
      );
      const walletAddressManagementWallet = form.getValues(
        'walletAddressManagementWallet',
      );
      const keyStoreContractOwner = form.getValues('keyStoreContractOwner');
      const keyStorePaymentOfGasFee = form.getValues('keyStorePaymentOfGasFee');
      const keyStoreManagementWallet = form.getValues(
        'keyStoreManagementWallet',
      );

      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const isNotKeystore =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType !== 'key_keystore';

      if (isNotKeystore) {
        setModalInfo({ type });
        setWalletAttribute(defaultWalletAttribute);
        setIsRigsecModalOpen(true);
        return;
      }

      const hasExisting =
        (type === 1 &&
          (walletAddressContractOwner || keyStoreContractOwner)) ||
        (type === 2 &&
          (walletAddressPaymentOfGasFee || keyStorePaymentOfGasFee)) ||
        (type === 3 &&
          (walletAddressManagementWallet || keyStoreManagementWallet));

      if (hasExisting) {
        confirmOverwrite(() => {
          setIsModalOpen(true);
          setModalInfo({ type });
        });
      } else {
        setIsModalOpen(true);
        setModalInfo({ type });
      }
    },
    [
      confirmOverwrite,
      defaultWalletAttribute,
      form,
      keyServiceList,
      keyServiceName,
      setIsModalOpen,
      setIsRigsecModalOpen,
      setModalInfo,
      setWalletAttribute,
    ],
  );

  // ── setWalletInfo：keystore 路径生成（密码 Modal 提交）──
  const setWalletInfo = useCallback(
    async (values: { password?: string }) => {
      const { password } = values;
      const currentBlockchainId = form.getValues('blockchainId');
      const selectedBlockchainInner = blockchainList?.find(
        (item) => item.key === currentBlockchainId,
      );
      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const tokenName = form.getValues('name');

      const storageType =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType || 'key_keystore';
      const blockchainCode =
        (selectedBlockchainInner as (BlockchainOption & { blockchainCode?: string }) | undefined)
          ?.blockchainCode || '';

      try {
        const res = await generateWalletMutation.mutateAsync({
          chainType,
          // 注意：明文 password，generateWalletKeystore 内部 AES 加密。
          password: password ?? '',
          walletType: 1,
          storageType,
          // 源 useWalletManagement 255：keyServiceCode 两分支恒传（选中项优先，
          // 回退 keyServiceName），keystore/rigsec 均不省略。
          keyServiceCode: selectedKeyService?.keyServiceCode || keyServiceName,
          roleName: String(modalInfo.type),
          blockchainCode,
          tokenName: tokenName ?? '',
          ifAdd: true,
        });

        if (res) {
          const { keystore, walletAddress } = res;
          if (modalInfo.type === 1) {
            form.setValue('walletAddressContractOwner', walletAddress);
            form.setValue('keyStoreContractOwner', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordContractOwner',
              password,
            );
          } else if (modalInfo.type === 2) {
            form.setValue('walletAddressPaymentOfGasFee', walletAddress);
            form.setValue('keyStorePaymentOfGasFee', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordPaymentOfGasFee',
              password,
            );
          } else {
            form.setValue('walletAddressManagementWallet', walletAddress);
            form.setValue('keyStoreManagementWallet', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordManagementWallet',
              password,
            );
          }
        }
        if (res) {
          form1.reset();
          setIsModalOpen(false);
        }
      } catch {
        toast.error(t('td_toast_wallet_generate_failed'));
      }
    },
    [
      blockchainList,
      chainType,
      form,
      form1,
      generateWalletMutation,
      keyServiceList,
      keyServiceName,
      modalInfo.type,
      setIsModalOpen,
      t,
    ],
  );

  // ── handleRigsecSubmit：rigsec/fireblocks 路径生成（Hot/Cold，无 password）──
  const handleRigsecSubmit = useCallback(async () => {
    try {
      setRigsecConfirmLoading(true);
      const currentBlockchainId = form.getValues('blockchainId');
      const selectedBlockchainInner = blockchainList?.find(
        (item) => item.key === currentBlockchainId,
      );
      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const tokenName = form.getValues('name');

      const storageType =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType || 'key_rigsec';
      const blockchainCode =
        (selectedBlockchainInner as (BlockchainOption & { blockchainCode?: string }) | undefined)
          ?.blockchainCode || '';

      const res = await generateWalletMutation.mutateAsync({
        chainType,
        walletType: walletAttribute,
        storageType,
        // 源 useWalletManagement 314：rigsec 分支同传 keyServiceCode。
        keyServiceCode: selectedKeyService?.keyServiceCode || keyServiceName,
        roleName: String(modalInfo.type),
        blockchainCode,
        tokenName: tokenName ?? '',
        ifAdd: !code,
      });

      if (res) {
        const { keystore, walletAddress } = res;
        if (modalInfo.type === 1) {
          form.setValue('walletAddressContractOwner', walletAddress);
          form.setValue('keyStoreContractOwner', keystore);
        } else if (modalInfo.type === 2) {
          form.setValue('walletAddressPaymentOfGasFee', walletAddress);
          form.setValue('keyStorePaymentOfGasFee', keystore);
        } else {
          form.setValue('walletAddressManagementWallet', walletAddress);
          form.setValue('keyStoreManagementWallet', keystore);
        }
        setWalletAttribute(defaultWalletAttribute);
      }
    } catch {
      toast.error(t('td_toast_wallet_generate_failed'));
    } finally {
      // 无论成功/失败，均关闭 Modal、重置表单、关闭 loading，避免卡在 loading 态。
      setRigsecConfirmLoading(false);
      setIsRigsecModalOpen(false);
      form1.reset();
    }
  }, [
    blockchainList,
    chainType,
    code,
    defaultWalletAttribute,
    form,
    form1,
    generateWalletMutation,
    keyServiceList,
    keyServiceName,
    modalInfo.type,
    setIsRigsecModalOpen,
    setWalletAttribute,
    t,
    walletAttribute,
  ]);

  return {
    rigsecConfirmLoading,
    checkWalletAddress,
    setWalletInfo,
    handleRigsecSubmit,
  };
}
