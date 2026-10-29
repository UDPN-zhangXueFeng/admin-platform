'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MINT_METHOD } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import { validateCoaSetup } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/coa-setup-utils';

import type { TdCoaSlice } from './use-td-draft';

/** RHF field 与实际可聚焦控件的稳定映射（Radix Select 不会注册原生 ref）。源: tokenized-deposit-form-content.tsx 96-119 */
const VALIDATION_TARGET_IDS: Partial<Record<keyof TDEditFormValues, string>> =
  {
    mintMethod: 'field-mintMethod',
    name: 'field-name',
    symbol: 'field-symbol',
    decimals: 'field-decimals',
    currencySymbol: 'select-currencySymbol',
    usPrice: 'field-usPrice',
    reserveAccountId: 'select-reserveAccountId',
    blockchainId: 'select-blockchainId',
    smartContractPackageId: 'select-smartContractPackageId',
    metaType: 'field-metaType',
    whitelistMode: 'select-whitelistMode',
    accountTypeList: 'account-type-1',
    keyServiceName: 'select-keyServiceName',
    walletAddressContractOwner: 'field-walletAddressContractOwner',
    walletAddressPaymentOfGasFee: 'field-walletAddressPaymentOfGasFee',
    walletAddressManagementWallet: 'field-walletAddressManagementWallet',
    keyStoreContractOwner: 'field-keyStoreContractOwner',
    keyStorePaymentOfGasFee: 'field-keyStorePaymentOfGasFee',
    keyStoreManagementWallet: 'field-keyStoreManagementWallet',
    passWordContractOwner: 'field-passWordContractOwner',
    passWordPaymentOfGasFee: 'field-passWordPaymentOfGasFee',
    passWordManagementWallet: 'field-passWordManagementWallet',
  };

/** add 模式向导步骤 key（顺序对齐 steps 数组：basic/finance/custody/review）。源: tokenized-deposit-form-content.tsx 121-123 */
const WIZARD_STEP_KEYS = ['basic', 'finance', 'custody', 'review'] as const;

/**
 * 向导步骤导航内核：currentStep/maxReachedStep state + 逐步校验 + 前后跳转 +
 * 首个无效字段聚焦 + wizardSteps 派生。
 * 源: tokenized-deposit-form-content.tsx 96-134、757-962（纯代码搬移）。
 */
export interface UseTdStepNavParams {
  form: UseFormReturn<TDEditFormValues>;
  flag: boolean;
  mintMethod: number | undefined;
  steps: { title: string; sub: string }[];
  coa: TdCoaSlice;
}

export function useTdStepNav({
  form,
  flag,
  mintMethod,
  steps,
  coa,
}: UseTdStepNavParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const {
    shouldShowSetupRequiredCoaSetup,
    shouldShowStablecoinCoaSetup,
    stablecoinCoaReadonly,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
  } = coa;
  const [currentStep, setCurrentStep] = React.useState(0);
  const [maxReachedStep, setMaxReachedStep] = React.useState(0);

  const scrollToForm = React.useCallback(() => {
    document
      .getElementById('td-onboard-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const focusFirstInvalidField = React.useCallback(
    (fields: Array<keyof TDEditFormValues>) => {
      const fieldName = fields.find(
        (field) => form.getFieldState(field).invalid,
      );
      const targetId = fieldName ? VALIDATION_TARGET_IDS[fieldName] : undefined;
      if (!targetId) return;

      requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      });
    },
    [form],
  );

  const validateStep = React.useCallback(
    async (index: number): Promise<boolean> => {
      if (index === 0) {
        const fields: Array<keyof TDEditFormValues> = [
          'mintMethod',
          'name',
          'symbol',
          'decimals',
          'currencySymbol',
          'usPrice',
          'blockchainId',
          'smartContractPackageId',
          'metaType',
          'whitelistMode',
        ];
        // 与源 showReserveAccount(!flag && mm!==20) 一致：Stablecoin + CBDC
        // 均显示储备账户，步骤校验同口径（TD=flag / MMF 除外）。
        if (!flag && mintMethod !== undefined && mintMethod !== MINT_METHOD.MMF) {
          fields.push('reserveAccountId');
        }
        return form.trigger(fields, { shouldFocus: true });
      }

      if (index === 1) {
        const accountTypeValid =
          mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ||
          mintMethod === MINT_METHOD.MMF
            ? await form.trigger('accountTypeList', { shouldFocus: true })
            : true;

        if (shouldShowSetupRequiredCoaSetup) {
          const errors = validateCoaSetup(tokenizedDepositCoaData);
          setTokenizedDepositCoaErrors(errors);
          return accountTypeValid && Object.keys(errors).length === 0;
        }

        if (shouldShowStablecoinCoaSetup && !stablecoinCoaReadonly) {
          const errors = validateCoaSetup(stablecoinCoaData);
          setStablecoinCoaErrors(errors);
          return accountTypeValid && Object.keys(errors).length === 0;
        }

        return accountTypeValid;
      }

      if (index === 2) {
        return form.trigger(
          [
            'keyServiceName',
            'walletAddressContractOwner',
            'walletAddressPaymentOfGasFee',
            'walletAddressManagementWallet',
            'keyStoreContractOwner',
            'keyStorePaymentOfGasFee',
            'keyStoreManagementWallet',
            'passWordContractOwner',
            'passWordPaymentOfGasFee',
            'passWordManagementWallet',
          ],
          { shouldFocus: true },
        );
      }

      return true;
    },
    [
      form,
      flag,
      mintMethod,
      setStablecoinCoaErrors,
      setTokenizedDepositCoaErrors,
      shouldShowSetupRequiredCoaSetup,
      shouldShowStablecoinCoaSetup,
      stablecoinCoaData,
      stablecoinCoaReadonly,
      tokenizedDepositCoaData,
    ],
  );

  const handleNextStep = React.useCallback(async () => {
    if (!(await validateStep(currentStep))) {
      const fieldsByStep: Array<Array<keyof TDEditFormValues>> = [
        [
          'mintMethod',
          'name',
          'symbol',
          'decimals',
          'currencySymbol',
          'usPrice',
          'blockchainId',
          'smartContractPackageId',
          'metaType',
          'whitelistMode',
          'reserveAccountId',
        ],
        ['accountTypeList'],
        [
          'keyServiceName',
          'walletAddressContractOwner',
          'walletAddressPaymentOfGasFee',
          'walletAddressManagementWallet',
          'keyStoreContractOwner',
          'keyStorePaymentOfGasFee',
          'keyStoreManagementWallet',
          'passWordContractOwner',
          'passWordPaymentOfGasFee',
          'passWordManagementWallet',
        ],
      ];
      focusFirstInvalidField(fieldsByStep[currentStep] ?? []);
      toast.error(t('td_toast_step_incomplete'));
      return;
    }
    const nextStep = Math.min(currentStep + 1, steps.length - 1);
    setCurrentStep(nextStep);
    setMaxReachedStep((value) => Math.max(value, nextStep));
    scrollToForm();
  }, [
    currentStep,
    focusFirstInvalidField,
    scrollToForm,
    steps.length,
    t,
    validateStep,
  ]);

  // Stepper 点击导航：回跳自由；前跳逐步校验，失败停在首个无效步并提示。
  const goToStep = React.useCallback(
    async (target: number) => {
      if (target <= currentStep) {
        setCurrentStep(target);
        scrollToForm();
        return;
      }
      for (let i = currentStep; i < target; i++) {
        if (!(await validateStep(i))) {
          setCurrentStep(i);
          toast.error(t('td_toast_step_incomplete'));
          scrollToForm();
          return;
        }
      }
      setCurrentStep(target);
      setMaxReachedStep((value) => Math.max(value, target));
      scrollToForm();
    },
    [currentStep, scrollToForm, validateStep, t],
  );

  const handlePreviousStep = React.useCallback(() => {
    setCurrentStep((value) => Math.max(0, value - 1));
    scrollToForm();
  }, [scrollToForm]);

  // ── add 模式向导步骤（key 顺序对齐 WIZARD_STEP_KEYS）──
  const wizardSteps = steps.map((s, i) => ({
    key: WIZARD_STEP_KEYS[i] ?? String(i),
    title: s.title,
    description: s.sub,
  }));

  return {
    validateStep,
    handleNextStep,
    goToStep,
    handlePreviousStep,
    currentStep,
    setCurrentStep,
    maxReachedStep,
    setMaxReachedStep,
    scrollToForm,
    wizardSteps,
  };
}
