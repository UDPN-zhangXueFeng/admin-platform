'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MINT_METHOD, RECON_DISABLED } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import type {
  BlockchainOption,
  CoaSetupInfo,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import { saveDraft, loadDraft, clearDraft } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/onboard-draft';

import type { TdFormDataSlice } from './use-td-form-data';
import { useCoaSetup } from './use-coa-setup';

/** useCoaSetup 返回去掉 coaQueryError 后的 16 键切片（对齐 FormState 透传面）。 */
export type TdCoaSlice = Omit<ReturnType<typeof useCoaSetup>, 'coaQueryError'>;

/** 源 initialValues 默认值（useForm defaultValues / Reset / 草稿恢复的公共基底）。源: tokenized-deposit-form-content.tsx 84-94 */
export const DEFAULT_FORM_VALUES = {
  mintMethod: MINT_METHOD.STABLECOIN,
  usPrice: '1',
  accountTypeList: [1],
  metaType: 5,
  whitelistMode: 'full',
  thresholdType: 'volume',
  thresholdFrequency: 'daily',
  enableTokenReconciliation: RECON_DISABLED,
  enableReserveAssetReconciliation: RECON_DISABLED,
} as TDEditFormValues;

/**
 * 草稿逻辑内核（仅 add 模式生效）：mount 检测 / 400ms 自动保存 / 恢复 / 丢弃 +
 * DRAFT-GAP-2 恢复后异步校验 + COA touched 包装 + 提交成功清草稿。
 * 源: tokenized-deposit-form-content.tsx 84-94、347-351、405-521、624-656、941-955。
 */
export interface UseTdDraftParams {
  mode: 'add' | 'edit';
  form: UseFormReturn<TDEditFormValues>;
  draftScope: { userId: string | undefined };
  data: TdFormDataSlice;
  coa: TdCoaSlice;
}

export function useTdDraft({
  mode,
  form,
  draftScope,
  data,
  coa,
}: UseTdDraftParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const {
    formValues,
    blockchainList,
    reserveList,
    smartContractNameList,
    keyServiceList,
    setFlag,
    setTokenTypeId,
    setReserveCurrency,
    setContractLanguage,
    setChainType,
    suppressSelectFirstOnceRef,
  } = data;
  const {
    tokenizedDepositCoaData,
    stablecoinCoaData,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    handleTokenizedDepositCoaChange,
    handleStablecoinCoaChange,
  } = coa;

  // ── 草稿（仅 add 模式；edit 不回填不自动保存）──
  const [draftBanner, setDraftBanner] = React.useState<{
    savedAt: number;
  } | null>(null);
  /** 恢复决定（Resume/Discard）或确认无草稿后才允许自动保存。 */
  const draftReadyRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 自动保存失败提示节流：首次失败弹一次，成功后再允许重弹。 */
  const draftSaveWarnedRef = React.useRef(false);
  /** 草稿恢复后待 Options 异步校验标记（restoreRef 触发一次，校验完置 false）。 */
  const restoredPendingRef = React.useRef(false);
  /** COA 本地 state 不在 RHF 内，单独追踪 touched 供自动保存判断。 */
  const coaTouchedRef = React.useRef(false);

  // ── 提交成功附加动作（仅 add：清草稿并停自动保存，防清后重存）──
  const handleSubmitSuccess = React.useCallback(() => {
    draftReadyRef.current = false;
    clearDraft(draftScope);
  }, [draftScope]);

  // ── 草稿：mount 检测（仅 add；有草稿先弹横幅，决定前暂停自动保存）──
  React.useEffect(() => {
    if (mode !== 'add') return;
    const draft = loadDraft(draftScope);
    if (draft) {
      setDraftBanner({ savedAt: draft.savedAt });
    } else {
      draftReadyRef.current = true;
    }
  }, [mode, draftScope]);

  // ── 草稿：自动保存（400ms debounce）──
  // 仅「用户真实编辑过」（RHF isDirty 或 COA touched）才保存：mount 默认值
  // （useBlockchainEffect 的 setValue）不置 isDirty，避免 fresh 页产生默认值
  // 草稿、下次访问误弹恢复横幅；Reset/恢复后 isDirty 归 false，清除的草稿
  // 不会被立即重存。
  const isFormDirty = form.formState.isDirty;
  React.useEffect(() => {
    if (mode !== 'add' || !draftReadyRef.current) return;
    if (!isFormDirty && !coaTouchedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // DRAFT-GAP-4：保存失败提示一次（节流，成功后重置允许再弹）
      const ok = saveDraft(draftScope, formValues, {
        tokenizedDeposit: tokenizedDepositCoaData,
        stablecoin: stablecoinCoaData,
      });
      if (!ok) {
        if (!draftSaveWarnedRef.current) {
          draftSaveWarnedRef.current = true;
          toast.warning(t('td_toast_draft_save_failed'));
        }
      } else {
        draftSaveWarnedRef.current = false;
      }
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    mode,
    draftScope,
    formValues,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    isFormDirty,
    t,
  ]);

  // ── 草稿：恢复（钱包/keystore/密码不缓存，恢复后保持为空）──
  const restoreDraft = React.useCallback(() => {
    const draft = loadDraft(draftScope);
    if (draft) {
      // blockchainId 变化会触发 keyService 重查，置标记跳过默认选首项；
      // 同链（query 缓存命中、effect 不重跑）则无需跳过。
      if (draft.formValues.blockchainId !== form.getValues('blockchainId')) {
        suppressSelectFirstOnceRef.current = true;
      }
      form.reset({
        ...DEFAULT_FORM_VALUES,
        ...draft.formValues,
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
      if (draft.coa.tokenizedDeposit) {
        setTokenizedDepositCoaData(draft.coa.tokenizedDeposit as CoaSetupInfo);
      }
      if (draft.coa.stablecoin) {
        setStablecoinCoaData(draft.coa.stablecoin as CoaSetupInfo);
      }
      // 重导桥接 state（声明式 query 依赖它们触发）
      if (draft.formValues.currencySymbol) {
        setReserveCurrency(draft.formValues.currencySymbol);
      }
      setTokenTypeId(draft.formValues.mintMethod ?? MINT_METHOD.STABLECOIN);
      setFlag(draft.formValues.mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT);
      const chain = blockchainList?.find(
        (b) => b.key === draft.formValues.blockchainId,
      );
      if (chain) {
        setContractLanguage(
          String(
            (chain as BlockchainOption & { contractLanguage?: unknown })
              .contractLanguage ?? '',
          ),
        );
        setChainType(chain.virtualMachineCode ?? 'evm');
      }
      toast.info(t('td_toast_draft_restored'));
    }
    // 触发 DRAFT-GAP-2：Options 加载后异步校验 reserve/contract/keyService 有效性
    restoredPendingRef.current = !!draft;
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, [
    form,
    blockchainList,
    draftScope,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    t,
  ]);

  const discardDraft = React.useCallback(() => {
    clearDraft(draftScope);
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, [draftScope]);

  // ── DRAFT-GAP-2：草稿恢复后异步校验 reserve/contract/keyService 是否仍存在于最新 Options ──
  // restoredPendingRef 在 restoreDraft 置 true；等三类 Options 全部加载后校验一次，清失效值。
  React.useEffect(() => {
    if (!restoredPendingRef.current) return;
    if (!reserveList || !smartContractNameList || !keyServiceList) return;
    let cleared = false;
    const ra = form.getValues('reserveAccountId');
    if (
      ra !== undefined &&
      ra !== null &&
      !reserveList.some((r) => String(r.reserveAccountId) === String(ra))
    ) {
      form.setValue('reserveAccountId', undefined);
      cleared = true;
    }
    const sc = form.getValues('smartContractPackageId');
    if (
      sc &&
      !smartContractNameList.some((s) => String(s.key) === String(sc))
    ) {
      form.setValue('smartContractPackageId', '');
      cleared = true;
    }
    const ks = form.getValues('keyServiceName');
    if (ks && !keyServiceList.some((k) => k.keyServiceCode === ks)) {
      form.setValue('keyServiceName', '');
      cleared = true;
    }
    if (cleared) {
      toast.info(t('td_toast_keyservice_invalid'));
    }
    restoredPendingRef.current = false;
  }, [reserveList, smartContractNameList, keyServiceList, form, t]);

  // ── COA onChange 包装（add 模式追踪 touched，供草稿自动保存判断）──
  const handleTdCoaChangeTracked = React.useCallback(
    (data: CoaSetupInfo) => {
      coaTouchedRef.current = true;
      handleTokenizedDepositCoaChange(data);
    },
    [handleTokenizedDepositCoaChange],
  );
  const handleScCoaChangeTracked = React.useCallback(
    (data: CoaSetupInfo) => {
      coaTouchedRef.current = true;
      handleStablecoinCoaChange(data);
    },
    [handleStablecoinCoaChange],
  );

  return {
    draftBanner,
    setDraftBanner,
    draftReadyRef,
    saveTimerRef,
    coaTouchedRef,
    restoreDraft,
    discardDraft,
    handleTdCoaChangeTracked,
    handleScCoaChangeTracked,
    handleSubmitSuccess,
  };
}
