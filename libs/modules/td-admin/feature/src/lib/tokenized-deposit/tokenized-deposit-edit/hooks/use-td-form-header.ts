'use client';

import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';

import type { TdFormDataSlice } from './use-td-form-data';

/**
 * 页头/进度/summary 派生内核（纯展示，不改业务逻辑）：pageTitle、badge、progress、
 * steps、summaryRows、当前选项 label 与 isFormDirty。
 * 源: tokenized-deposit-form-content.tsx 419、696-761（纯代码搬移）。
 */
export interface UseTdFormHeaderParams {
  mode: 'add' | 'edit';
  hasCode: boolean;
  form: UseFormReturn<TDEditFormValues>;
  data: TdFormDataSlice;
}

export function useTdFormHeader({
  mode,
  hasCode,
  form,
  data,
}: UseTdFormHeaderParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const {
    nameValue,
    symbol,
    blockchain,
    mintMethod,
    reserveAccountId,
    keyServiceName,
    smartContractPackageId,
    ownerWalletAddr,
    gasWalletAddr,
    mgmtWalletAddr,
    detailInfo,
    tokenTypeOptions,
    blockchainList,
    reserveList,
    smartContractNameList,
    keyServiceList,
  } = data;

  const isFormDirty = form.formState.isDirty;
  const applyStatus = detailInfo.applyStatus;

  // ── 页面标题（tokenized_deposit_0004 "**** Token "，replace 对齐源语义）──
  const pageTitle = t('tokenized_deposit_0004').replace(
    '****',
    hasCode ? t('Router_016') : t('tokenized_deposit_0132'),
  );
  const headerBadge = hasCode ? t('record_type_2') : t('td_draft_badge');
  const headerBadgeVariant: 'secondary' | 'outline' = hasCode
    ? 'secondary'
    : 'outline';

  // ── 进度 / summary 派生（纯展示，不改业务逻辑）──
  const completedWallets = [
    ownerWalletAddr,
    gasWalletAddr,
    mgmtWalletAddr,
  ].filter(Boolean).length;
  const progress = Math.min(
    92,
    28 +
      (nameValue ? 9 : 0) +
      (symbol ? 9 : 0) +
      (smartContractPackageId ? 12 : 0) +
      completedWallets * 8,
  );
  const progressStep = progress < 45 ? 0 : progress < 80 ? 1 : 2;
  const currentTypeLabel =
    tokenTypeOptions?.find(
      (item) => String(item.tokenTypeId) === String(mintMethod),
    )?.tokenTypeName ?? '';
  const currentBlockchainLabel =
    blockchainList?.find((item) => item.key === blockchain)?.value ?? '';
  const currentReserveLabel =
    reserveList?.find(
      (item) => String(item.reserveAccountId) === String(reserveAccountId),
    )?.reserveAccountName ?? '';
  const currentContractLabel =
    smartContractNameList?.find(
      (item) => String(item.key) === String(smartContractPackageId),
    )?.value ?? '';
  const currentKeyServiceLabel =
    keyServiceList?.find((item) => item.keyServiceCode === keyServiceName)
      ?.keyServiceName ?? '';
  const steps =
    mode === 'add'
      ? [
          { title: t('td_step_1_title'), sub: t('td_step_1_sub') },
          { title: t('td_form_finance_title'), sub: t('td_form_finance_desc') },
          { title: t('key_custody_title'), sub: t('td_section_custody_desc') },
          { title: t('td_form_review_title'), sub: t('td_form_review_desc') },
        ]
      : [
          { title: t('td_step_1_title'), sub: t('td_step_1_sub') },
          { title: t('td_step_2_title'), sub: t('td_step_2_sub') },
          { title: t('td_step_3_title'), sub: t('td_step_3_sub') },
        ];
  const summaryRows = [
    { label: t('td_summary_identity'), complete: !!(nameValue && symbol) },
    {
      label: t('td_summary_network'),
      complete: !!(blockchain && smartContractPackageId),
    },
    { label: t('td_summary_accounting'), complete: !!mintMethod },
    { label: t('td_summary_custody'), complete: !!keyServiceName },
    { label: t('td_summary_wallets'), complete: completedWallets === 3 },
  ];

  return {
    isFormDirty,
    applyStatus,
    pageTitle,
    headerBadge,
    headerBadgeVariant,
    progress,
    progressStep,
    currentTypeLabel,
    currentBlockchainLabel,
    currentReserveLabel,
    currentContractLabel,
    currentKeyServiceLabel,
    steps,
    summaryRows,
    completedWallets,
  };
}
