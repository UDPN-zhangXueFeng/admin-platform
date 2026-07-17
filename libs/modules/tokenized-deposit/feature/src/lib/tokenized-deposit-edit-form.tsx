'use client';

import * as React from 'react';
import type {
  BlockchainOption,
  SmartContractOption,
} from '@myorg/modules/tokenized-deposit/data-access';
import { MINT_METHOD } from '@myorg/modules/tokenized-deposit/util';

import { TokenBasicInfoSection } from './tokenized-deposit-edit/token-basic-info-section';
import { ReconciliationConfigSection } from './tokenized-deposit-edit/reconciliation-config-section';
import { KeyCustodySection } from './tokenized-deposit-edit/key-custody-section';
import { AdminWalletSection } from './tokenized-deposit-edit/admin-wallet-section';
import { AccountTypeSection } from './tokenized-deposit-edit/account-type-section';
import { AccountConfigurationMMF } from './tokenized-deposit-edit/account-configuration-mmf';
import {
  BottomActionBar,
  OnboardHeader,
  SummaryAside,
} from './tokenized-deposit-edit/ui/page-shell';
import { CoaSetupCard } from '@myorg/modules/tokenized-deposit/ui';
import {
  useTokenizedDepositForm,
  type TokenizedDepositFormState,
} from './tokenized-deposit-form-content';

/**
 * TokenizedDepositEditForm —— 编辑页（route `/tokenized-deposit/edit?code=xxx`）。
 *
 * 与新建页（`tokenized-deposit-add-form.tsx`）彻底分离：各自调用共享 hook
 * `useTokenizedDepositForm`（edit 传 mode='edit' + code），仅渲染堆叠布局。
 *
 * edit 专属：useDetailInit 回填（hook 内按 code 启用）、applyStatus===35 整页只读、
 * 原有 OnboardHeader + 双栏(SummaryAside) + BottomActionBar chrome。不涉及草稿。
 *
 * Modal / AlertDialog 由 hook 统一组装的 `sharedDialogs` 承载（与 add 页同源，零重复）。
 */
export interface TokenizedDepositEditFormProps {
  code?: string;
}

export function TokenizedDepositEditForm({
  code,
}: TokenizedDepositEditFormProps): React.JSX.Element {
  const s = useTokenizedDepositForm({ mode: 'edit', code });
  return <EditStacked s={s} />;
}

function EditStacked({
  s,
}: {
  s: TokenizedDepositFormState;
}): React.JSX.Element {
  const {
    t,
    router,
    form,
    onSubmit,
    loading,
    pageTitle,
    headerBadge,
    headerBadgeVariant,
    progress,
    progressStep,
    steps,
    hasCode,
    detailInfo,
    flag,
    chainType,
    mintMethod,
    symbol,
    currency,
    thresholdType,
    reserveList,
    blockchainList,
    currencyList,
    smartContractNameList,
    tokenTypeOptions,
    onBlockchainChange,
    onCurrencyChange,
    onTokenTypeChange,
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
    handleTokenizedDepositCoaChange,
    handleStablecoinCoaChange,
    applyStatus,
    reserveAccountId,
    reserveReconValue,
    keyServiceList,
    resetAdminWalletFields,
    shouldHideKeystoreAndPassword,
    shouldHideGenerateWalletAction,
    isAdminWalletDisabled,
    checkWalletAddress,
    summaryRows,
    currentTypeLabel,
    currentBlockchainLabel,
    completedWallets,
    sharedDialogs,
  } = s;

  return (
    <div className="flex flex-col">
      <OnboardHeader
        onBack={() => router.back()}
        backLabel={t('td_back_to_registry')}
        title={pageTitle}
        badge={headerBadge}
        badgeVariant={headerBadgeVariant}
        description={t('td_header_desc')}
        progressLabel={t('td_progress_label')}
        progress={progress}
        steps={steps}
        activeStep={progressStep}
        maxReachedStep={progressStep}
      />

      <div className="grid items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <form
          id="td-onboard-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className={`flex min-w-0 flex-col gap-6 ${
            loading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <TokenBasicInfoSection
            control={form.control}
            hasCode={hasCode}
            detailInfo={detailInfo}
            flag={flag}
            chainType={chainType}
            mintMethod={mintMethod}
            symbol={symbol}
            currency={currency}
            thresholdType={thresholdType}
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
          {shouldShowSetupRequiredCoaSetup ? (
            <CoaSetupCard
              data={tokenizedDepositCoaData}
              accountTemplateOptions={coaTemplateOptions}
              timezoneOptions={coaTimezoneOptions}
              errors={tokenizedDepositCoaErrors}
              onChange={handleTokenizedDepositCoaChange}
            />
          ) : null}
          {shouldShowStablecoinCoaSetup ? (
            <CoaSetupCard
              data={stablecoinCoaData}
              loading={stablecoinCoaLoading}
              readonly={stablecoinCoaReadonly}
              accountTemplateOptions={coaTemplateOptions}
              timezoneOptions={coaTimezoneOptions}
              errors={stablecoinCoaErrors}
              onChange={handleStablecoinCoaChange}
            />
          ) : null}
          {flag && mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ? (
            <AccountTypeSection
              control={form.control}
              setValue={form.setValue}
              getValues={form.getValues}
              hasCode={hasCode}
              applyStatus={applyStatus}
            />
          ) : null}
          {mintMethod === MINT_METHOD.MMF ? (
            <AccountConfigurationMMF
              control={form.control}
              setValue={form.setValue}
              hasCode={hasCode}
              applyStatus={applyStatus}
            />
          ) : null}
          <ReconciliationConfigSection
            control={form.control}
            setValue={form.setValue}
            hasCode={hasCode}
            detailInfo={detailInfo}
            reserveList={reserveList}
            reserveAccountId={reserveAccountId}
            reserveReconValue={reserveReconValue}
            mintMethod={mintMethod}
          />
          <KeyCustodySection
            control={form.control}
            hasCode={hasCode}
            applyStatus={applyStatus}
            keyServiceList={keyServiceList}
            onKeyServiceChange={(value) => {
              form.setValue('keyServiceName', value);
              resetAdminWalletFields();
            }}
          />
          <AdminWalletSection
            control={form.control}
            hasCode={hasCode}
            applyStatus={applyStatus}
            shouldHideKeystoreAndPassword={shouldHideKeystoreAndPassword}
            shouldHideGenerateWalletAction={shouldHideGenerateWalletAction}
            isAdminWalletDisabled={isAdminWalletDisabled}
            onGenerateWallet={checkWalletAddress}
          />
        </form>

        <SummaryAside
          title={t('td_summary_title')}
          description={t('td_summary_desc')}
          tokenTypeLabelLabel={t('tokenized_deposit_0062')}
          tokenTypeLabel={currentTypeLabel}
          rows={summaryRows}
          deployNetworkLabelLabel={t('td_summary_deploy_network')}
          deployNetworkLabel={currentBlockchainLabel}
          completeLabel={t('td_summary_complete')}
          requiredLabel={t('td_summary_required')}
          walletsIncompleteAlert={
            completedWallets < 3
              ? {
                  title: t('td_summary_wallets_alert_title'),
                  description: t('td_summary_wallets_alert_desc'),
                }
              : null
          }
        />
      </div>

      <BottomActionBar
        onBack={() => router.back()}
        backLabel={t('PUB_GoBack')}
        submitLabel={t('PUB_Submit')}
        loading={loading}
        formId="td-onboard-form"
      />

      {sharedDialogs}
    </div>
  );
}
