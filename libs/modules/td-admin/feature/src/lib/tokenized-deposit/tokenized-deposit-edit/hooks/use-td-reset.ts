'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MINT_METHOD } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import type {
  BlockchainOption,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import { clearDraft } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/onboard-draft';

import type { TdCoaSlice } from './use-td-draft';
import { DEFAULT_FORM_VALUES } from './use-td-draft';
import type { TdFormDataSlice } from './use-td-form-data';

/**
 * Reset application 内核：确认弹窗 state + 清草稿/默认值/重放 mount 默认链/币种。
 * 源: tokenized-deposit-form-content.tsx 206、523-597（纯代码搬移）。
 */
export interface UseTdResetParams {
  form: UseFormReturn<TDEditFormValues>;
  draftScope: { userId: string | undefined };
  coaTouchedRef: React.RefObject<boolean>;
  data: TdFormDataSlice;
  coa: TdCoaSlice;
  setCurrentStep: (value: number) => void;
  setMaxReachedStep: (
    value: number | ((prev: number) => number),
  ) => void;
}

export function useTdReset({
  form,
  draftScope,
  coaTouchedRef,
  data,
  coa,
  setCurrentStep,
  setMaxReachedStep,
}: UseTdResetParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const {
    blockchainList,
    currencyList,
    keyServiceList,
    setDetailInfo,
    setFlag,
    setTokenTypeId,
    setReserveCurrency,
    setContractLanguage,
    setChainType,
  } = data;
  const {
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
  } = coa;

  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);

  // ── Reset application（清草稿 + 默认值 + 重放 mount 默认链/币种）──
  const handleReset = React.useCallback(() => {
    const prevChain = form.getValues('blockchainId');
    clearDraft(draftScope);
    coaTouchedRef.current = false;
    // G2：显式清钱包字段（DEFAULT_FORM_VALUES 不含钱包，与 restoreDraft 一致确保清空）
    form.reset({
      ...DEFAULT_FORM_VALUES,
      walletAddressContractOwner: '',
      walletAddressPaymentOfGasFee: '',
      walletAddressManagementWallet: '',
      keyStoreContractOwner: '',
      keyStorePaymentOfGasFee: '',
      keyStoreManagementWallet: '',
      passWordContractOwner: '',
      passWordPaymentOfGasFee: '',
      passWordManagementWallet: '',
    });
    setTokenizedDepositCoaData(null);
    setStablecoinCoaData(null);
    setTokenizedDepositCoaErrors({});
    setStablecoinCoaErrors({});
    setDetailInfo({});
    setFlag(false);
    setTokenTypeId(MINT_METHOD.STABLECOIN);
    // 重放 useBlockchainEffect mount 默认值（effect 依赖未变不会自动重跑）
    const activeBlockchain = blockchainList?.find((b) => b.status === 1);
    form.setValue('decimals', 8);
    form.setValue('currencySymbol', currencyList?.[0]?.value);
    form.setValue('blockchainId', activeBlockchain?.key);
    if (currencyList?.[0]?.value) {
      setReserveCurrency(currencyList[0].value);
    }
    if (activeBlockchain) {
      setContractLanguage(
        String(
          (
            activeBlockchain as BlockchainOption & {
              contractLanguage?: unknown;
            }
          ).contractLanguage ?? '',
        ),
      );
      setChainType(activeBlockchain.virtualMachineCode ?? 'evm');
      if (activeBlockchain.virtualMachineCode === 'tron') {
        form.setValue('metaType', 1);
      }
    } else {
      setContractLanguage('');
      setChainType('evm');
    }
    // 链未变时 keyService query 缓存命中、select-first effect 不重跑，
    // 显式补选首项对齐 fresh mount 行为；链已变则由 effect 处理。
    if (
      activeBlockchain &&
      prevChain === activeBlockchain.key &&
      keyServiceList.length > 0
    ) {
      form.setValue('keyServiceName', keyServiceList[0]?.keyServiceCode ?? '');
    }
    setCurrentStep(0);
    setMaxReachedStep(0);
    setResetConfirmOpen(false);
    toast.info(t('td_toast_reset_done'));
  }, [
    form,
    blockchainList,
    currencyList,
    draftScope,
    keyServiceList,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
    t,
  ]);

  return {
    resetConfirmOpen,
    setResetConfirmOpen,
    handleReset,
  };
}
