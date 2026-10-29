'use client';

import * as React from 'react';
import type { SmartContractOption } from '@myorg/modules/td-admin/data-access';
import { BlockchainOption } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';
import { MINT_METHOD } from '@myorg/modules/td-admin/data-access';

import { TokenBasicInfoSection } from '../token-basic-info-section';
import { ReconciliationConfigSection } from '../reconciliation-config-section';
import { KeyCustodySection } from '../key-custody-section';
import { AdminWalletSection } from '../admin-wallet-section';
import { AccountTypeSection } from '../account-type-section';
import { AccountConfigurationMMF } from '../account-configuration-mmf';
import { OnboardReviewSection } from '../onboard-review-section';
import { CoaSetupCard } from '../../coa-setup-card';
import type { TokenizedDepositFormState } from '../../tokenized-deposit-form-content';

/**
 * add 向导 4 步内容（basic / finance / custody / review），接收完整 FormState 切片
 * 就地解构。源: tokenized-deposit-add-form.tsx 186-324（纯代码搬移，行为零变化）。
 */

export function AddStepBasicInfo({
  s,
}: {
  s: TokenizedDepositFormState;
}): React.JSX.Element {
  const {
    form,
    hasCode,
    detailInfo,
    flag,
    chainType,
    mintMethod,
    currency,
    reserveList,
    blockchainList,
    currencyList,
    smartContractNameList,
    tokenTypeOptions,
    onBlockchainChange,
    onCurrencyChange,
    onTokenTypeChange,
  } = s;

  return (
    <TokenBasicInfoSection
      control={form.control}
      hasCode={hasCode}
      detailInfo={detailInfo}
      flag={flag}
      chainType={chainType}
      mintMethod={mintMethod}
      currency={currency}
      reserveList={reserveList}
      blockchainList={blockchainList as BlockchainOption[] | undefined}
      currencyList={currencyList}
      smartContractNameList={
        smartContractNameList as SmartContractOption[] | undefined
      }
      tokenTypeOptions={tokenTypeOptions ?? []}
      onBlockchainChange={onBlockchainChange}
      onCurrencyChange={onCurrencyChange}
      onTokenTypeChange={onTokenTypeChange}
    />
  );
}

export function AddStepFinance({
  s,
}: {
  s: TokenizedDepositFormState;
}): React.JSX.Element {
  const {
    t,
    form,
    hasCode,
    mintMethod,
    flag,
    applyStatus,
    detailInfo,
    reserveList,
    reserveAccountId,
    reserveReconValue,
    shouldShowSetupRequiredCoaSetup,
    shouldShowStablecoinCoaSetup,
    tokenizedDepositCoaData,
    tokenizedDepositCoaErrors,
    stablecoinCoaData,
    stablecoinCoaErrors,
    stablecoinCoaLoading,
    stablecoinCoaReadonly,
    coaTemplateOptions,
    coaTimezoneOptions,
    handleTdCoaChangeTracked,
    handleScCoaChangeTracked,
  } = s;

  return (
    <div className="flex flex-col gap-9">
      {shouldShowSetupRequiredCoaSetup ? (
        <CoaSetupCard
          embedded
          data={tokenizedDepositCoaData}
          accountTemplateOptions={coaTemplateOptions}
          timezoneOptions={coaTimezoneOptions}
          errors={tokenizedDepositCoaErrors}
          onChange={handleTdCoaChangeTracked}
        />
      ) : shouldShowStablecoinCoaSetup ? (
        <CoaSetupCard
          embedded
          data={stablecoinCoaData}
          loading={stablecoinCoaLoading}
          readonly={stablecoinCoaReadonly}
          accountTemplateOptions={coaTemplateOptions}
          timezoneOptions={coaTimezoneOptions}
          errors={stablecoinCoaErrors}
          onChange={handleScCoaChangeTracked}
        />
      ) : (
        <section>
          <h3 className="text-sm font-semibold">
            {t('tokenized_deposit_coa_title')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('td_section_coa_desc')}
          </p>
          <div className="mt-5 rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
            {mintMethod === MINT_METHOD.MMF
              ? t('td_form_mmf_no_coa')
              : mintMethod === undefined ||
                  mintMethod === MINT_METHOD.STABLECOIN
                ? t('td_form_select_token_first')
                : t('td_form_cbdc_no_coa')}
          </div>
        </section>
      )}

      {flag && mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ? (
        <AccountTypeSection
          embedded
          control={form.control}
          setValue={form.setValue}
          getValues={form.getValues}
          hasCode={hasCode}
          applyStatus={applyStatus}
        />
      ) : null}
      {mintMethod === MINT_METHOD.MMF ? (
        <AccountConfigurationMMF
          embedded
          control={form.control}
          setValue={form.setValue}
          hasCode={hasCode}
          applyStatus={applyStatus}
        />
      ) : null}
      <ReconciliationConfigSection
        embedded
        control={form.control}
        setValue={form.setValue}
        hasCode={hasCode}
        detailInfo={detailInfo}
        reserveList={reserveList}
        reserveAccountId={reserveAccountId}
        reserveReconValue={reserveReconValue}
        mintMethod={mintMethod}
      />
    </div>
  );
}

export function AddStepCustody({
  s,
}: {
  s: TokenizedDepositFormState;
}): React.JSX.Element {
  const {
    form,
    hasCode,
    applyStatus,
    keyServiceList,
    keyServiceError,
    resetAdminWalletFields,
    shouldHideKeystoreAndPassword,
    shouldHideGenerateWalletAction,
    isAdminWalletDisabled,
    checkWalletAddress,
  } = s;

  return (
    <div className="flex flex-col gap-9">
      <KeyCustodySection
        embedded
        control={form.control}
        hasCode={hasCode}
        applyStatus={applyStatus}
        keyServiceList={keyServiceList}
        keyServiceError={keyServiceError}
        onKeyServiceChange={(value) => {
          form.setValue('keyServiceName', value);
          resetAdminWalletFields();
        }}
      />
      <AdminWalletSection
        embedded
        control={form.control}
        hasCode={hasCode}
        applyStatus={applyStatus}
        shouldHideKeystoreAndPassword={shouldHideKeystoreAndPassword}
        shouldHideGenerateWalletAction={shouldHideGenerateWalletAction}
        isAdminWalletDisabled={isAdminWalletDisabled}
        onGenerateWallet={checkWalletAddress}
      />
    </div>
  );
}

export function AddStepReview({
  s,
}: {
  s: TokenizedDepositFormState;
}): React.JSX.Element {
  const {
    formValues,
    currentTypeLabel,
    currentBlockchainLabel,
    currentContractLabel,
    currentReserveLabel,
    currentKeyServiceLabel,
    mintMethod,
    tokenizedDepositCoaData,
    stablecoinCoaData,
  } = s;

  return (
    <OnboardReviewSection
      values={formValues}
      tokenTypeLabel={currentTypeLabel}
      blockchainLabel={currentBlockchainLabel}
      contractLabel={currentContractLabel}
      reserveLabel={currentReserveLabel}
      keyServiceLabel={currentKeyServiceLabel}
      financialBookName={
        mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT
          ? tokenizedDepositCoaData.financialBookName
          : stablecoinCoaData.financialBookName
      }
    />
  );
}
