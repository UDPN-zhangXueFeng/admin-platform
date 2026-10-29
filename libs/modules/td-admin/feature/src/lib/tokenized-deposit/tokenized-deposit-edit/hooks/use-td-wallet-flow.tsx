'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { useRouter } from '@myorg/shared/util-i18n';
import { MINT_METHOD, RECON_DISABLED } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import type {
  CoaSetupOption,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';

import { useDetailInit } from './use-detail-init';
import { useBlockchainEffect } from './use-blockchain-effect';
import { useWalletManagement } from './use-wallet-management';
import { useTokenizedDepositSubmit } from './use-tokenized-deposit-submit';
import type { TdCoaSlice } from './use-td-draft';
import type { TdFormDataSlice } from './use-td-form-data';
import { TdSharedDialogs } from '../ui/td-shared-dialogs';

/**
 * 钱包/回填/提交接线内核：双确认 AlertDialog state + useWalletManagement +
 * useDetailInit + useBlockchainEffect + useTokenizedDepositSubmit + 类型切换/币种
 * handlers + 共享 sharedDialogs 元素。
 * 源: tokenized-deposit-form-content.tsx 251-403、964-1033（纯代码搬移）。
 */
export interface UseTdWalletFlowParams {
  form: UseFormReturn<TDEditFormValues>;
  form1: UseFormReturn<{ password?: string }>;
  code?: string;
  mode: 'add' | 'edit';
  router: ReturnType<typeof useRouter>;
  data: TdFormDataSlice;
  coa: TdCoaSlice;
  handleSubmitSuccess: () => void;
}

export function useTdWalletFlow({
  form,
  form1,
  code,
  mode,
  router,
  data,
  coa,
  handleSubmitSuccess,
}: UseTdWalletFlowParams) {
  const {
    nameValue,
    detailInfo,
    blockchain,
    reserveAccountId,
    keyServiceName,
    contractLanguage,
    chainType,
    tokenType,
    blockchainList,
    currencyList,
    keyServiceList,
    setDetailInfo,
    setFlag,
    setContractLanguage,
    setChainType,
    setTokenTypeId,
    setReserveCurrency,
  } = data;
  const {
    tokenizedDepositCoaData,
    stablecoinCoaData,
    coaTimezoneOptions,
    stablecoinCoaReadonly,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
  } = coa;

  // ── 双确认 AlertDialog state（替代源 antd modal.confirm）──
  const [overwriteConfirm, setOverwriteConfirm] = React.useState<{
    open: boolean;
    onOk: (() => void) | null;
  }>({ open: false, onOk: null });
  const [submitConfirm, setSubmitConfirm] = React.useState<{
    open: boolean;
    onOk: (() => Promise<void> | void) | null;
  }>({ open: false, onOk: null });

  const confirmOverwrite = React.useCallback((onOk: () => void) => {
    setOverwriteConfirm({ open: true, onOk });
  }, []);
  const confirmSubmit = React.useCallback(
    (onOk: () => Promise<void> | void) => {
      setSubmitConfirm({ open: true, onOk });
    },
    [],
  );

  // ── 钱包管理（双生成路径 + 回填 + 竞态保护）──
  const wallet = useWalletManagement({
    form,
    form1,
    code,
    detailInfo,
    blockchainList,
    keyServiceList,
    keyServiceName,
    chainType,
    blockchain,
    nameValue,
    confirmOverwrite,
  });
  const {
    setIsModalOpen,
    setIsRigsecModalOpen,
    setWalletAttribute,
    defaultWalletAttribute,
    setWalletFields,
    resetAdminWalletFields,
  } = wallet;

  // ── 回填（编辑态，code 存在时 useDetailInit 内部 useTDOperationEditDetailQuery）──
  useDetailInit({
    form,
    code,
    contractLanguage,
    blockchainList,
    getDeployInfo: (lang, type) => {
      setContractLanguage(lang);
      setTokenTypeId(type);
    },
    setWalletFields,
    setDetailInfo,
    setFlag,
    setTokenTypeId,
    setTokenizedDepositCoaData: coa.setTokenizedDepositCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaData: coa.setStablecoinCoaData,
    setStablecoinCoaErrors,
  });

  // ── 区块链联动（mount 默认值 + 切链回调）──
  const onBlockchainChange = useBlockchainEffect({
    form,
    code,
    currencyList,
    blockchainList,
    tokenType,
    getReserveList: (currencySymbol) => setReserveCurrency(currencySymbol),
    getDeployInfo: (lang, type) => {
      setContractLanguage(lang);
      setTokenTypeId(type);
    },
    getKeyServiceList: () => {
      // no-op：useKeyService 已声明式监听 blockchainId，切链自动重查。
    },
    resetAdminWalletFields,
    setContractLanguage,
    setChainType,
    setTokenTypeId,
  });

  // ── 提交（新增 useCreateTDApplyMutation / 编辑 useEditTDOperationMutation）──
  const { loading, onSubmit } = useTokenizedDepositSubmit({
    confirmSubmit,
    routerBack: () => router.back(),
    successMessageKey: 'PUB_Success',
    code,
    detailInfo,
    keyServiceList,
    reserveAccountId,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    timezoneOptions: coaTimezoneOptions as CoaSetupOption[] | undefined,
    stablecoinCoaReadonly,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
    onSubmitSuccess: mode === 'add' ? handleSubmitSuccess : undefined,
  });

  // ── handlers（onCurrencyChange / onTokenTypeChange / Modal cancel）──
  const onCurrencyChange = React.useCallback(
    (value: string) => setReserveCurrency(value),
    [],
  );
  const onTokenTypeChange = React.useCallback(
    (value: number) => {
      form.setValue('mintMethod', value);
      setFlag(value === MINT_METHOD.TOKENIZED_DEPOSIT);
      setTokenTypeId(value);
      form.setValue('smartContractPackageId', '');
      // P0-1：按类型统一清理不适用字段（文档 14.1 表），避免类型切换后残留污染 payload。
      if (value === MINT_METHOD.STABLECOIN) {
        form.setValue('accountTypeList', [1]);
      } else if (value === MINT_METHOD.TOKENIZED_DEPOSIT) {
        form.setValue('accountTypeList', [1]);
        form.setValue('reserveAccountId', undefined);
        form.setValue('enableReserveAssetReconciliation', RECON_DISABLED);
      } else if (value === MINT_METHOD.MMF) {
        form.setValue('accountTypeList', [3]);
        form.setValue('reserveAccountId', undefined);
        form.setValue('enableReserveAssetReconciliation', RECON_DISABLED);
      }
    },
    [form],
  );
  const handleGenerateWalletCancel = React.useCallback(() => {
    setIsModalOpen(false);
  }, [setIsModalOpen]);
  const handleRigsecCancel = React.useCallback(() => {
    setIsRigsecModalOpen(false);
    setWalletAttribute(defaultWalletAttribute);
  }, [defaultWalletAttribute, setIsRigsecModalOpen, setWalletAttribute]);

  // ── AlertDialog 确认/取消 ──
  const handleOverwriteConfirm = React.useCallback(() => {
    setOverwriteConfirm((prev) => {
      prev.onOk?.();
      return { open: false, onOk: null };
    });
  }, []);
  const handleOverwriteCancel = React.useCallback(() => {
    setOverwriteConfirm({ open: false, onOk: null });
  }, []);
  const handleSubmitConfirm = React.useCallback(() => {
    const onOk = submitConfirm.onOk;
    setSubmitConfirm({ open: false, onOk: null });
    void onOk?.();
  }, [submitConfirm.onOk]);
  const handleSubmitCancel = React.useCallback(() => {
    setSubmitConfirm({ open: false, onOk: null });
  }, []);

  // ── 共享 Modals / AlertDialogs（add/edit 两个 return 共用）──
  const sharedDialogs = (
    <TdSharedDialogs
      isModalOpen={wallet.isModalOpen}
      onGenerateWalletCancel={handleGenerateWalletCancel}
      onGenerateWalletSubmit={wallet.setWalletInfo}
      isRigsecModalOpen={wallet.isRigsecModalOpen}
      modalInfo={wallet.modalInfo}
      walletAttribute={wallet.walletAttribute}
      walletAttributeOptions={wallet.walletAttributeOptions}
      rigsecConfirmLoading={wallet.rigsecConfirmLoading}
      tokenName={nameValue}
      currentKeyService={wallet.currentKeyService}
      onWalletAttributeChange={wallet.setWalletAttribute}
      onRigsecCancel={handleRigsecCancel}
      onRigsecSubmit={wallet.handleRigsecSubmit}
      overwriteConfirm={overwriteConfirm}
      onOverwriteCancel={handleOverwriteCancel}
      onOverwriteConfirm={handleOverwriteConfirm}
      submitConfirm={submitConfirm}
      onSubmitCancel={handleSubmitCancel}
      onSubmitConfirm={handleSubmitConfirm}
    />
  );

  return {
    overwriteConfirm,
    setOverwriteConfirm,
    submitConfirm,
    setSubmitConfirm,
    confirmOverwrite,
    confirmSubmit,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    handleSubmitConfirm,
    handleSubmitCancel,
    ...wallet,
    onBlockchainChange,
    loading,
    onSubmit,
    onCurrencyChange,
    onTokenTypeChange,
    handleGenerateWalletCancel,
    handleRigsecCancel,
    sharedDialogs,
  };
}
