'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Card,
  CardContent,
  Toaster,
} from '@myorg/shared/ui';
import type {
  BlockchainOption,
  SmartContractOption,
} from '@myorg/modules/tokenized-deposit/data-access';
import { MINT_METHOD, formatDraftTime } from '@myorg/modules/tokenized-deposit/util';

import { TokenBasicInfoSection } from './tokenized-deposit-edit/token-basic-info-section';
import { ReconciliationConfigSection } from './tokenized-deposit-edit/reconciliation-config-section';
import { KeyCustodySection } from './tokenized-deposit-edit/key-custody-section';
import { AdminWalletSection } from './tokenized-deposit-edit/admin-wallet-section';
import { AccountTypeSection } from './tokenized-deposit-edit/account-type-section';
import { AccountConfigurationMMF } from './tokenized-deposit-edit/account-configuration-mmf';
import { CoaSetupCard } from '@myorg/modules/tokenized-deposit/ui';
import { OnboardReviewSection } from './tokenized-deposit-edit/onboard-review-section';
import {
  WizardHeader,
  DraftBanner,
  WizardStepper,
  WizardFooter,
} from './tokenized-deposit-edit/ui/onboard-wizard';
import {
  useTokenizedDepositForm,
  type TokenizedDepositFormState,
} from './tokenized-deposit-form-content';

/**
 * TokenizedDepositAddForm —— 新建（onboard）向导页（route `/tokenized-deposit/onboard`）。
 *
 * 与编辑页（`tokenized-deposit-edit-form.tsx`）彻底分离：二者各自调用共享 hook
 * `useTokenizedDepositForm`（参数化 mode/code），仅渲染各自的布局树。共享 hook 承载
 * 全部表单接线（form + 6 hooks + 3 query + sections 数据），渲染层零业务逻辑。
 *
 * 本组件只负责 add 向导布局：页头 → 草稿横幅 → 单卡片[Stepper + 分步内容 + Footer]
 * → 自动保存脚注，以及 add 专属的草稿/步骤/Reset/二次确认弹窗。
 */
export function TokenizedDepositAddForm(): React.JSX.Element {
  const s = useTokenizedDepositForm({ mode: 'add' });
  return <AddWizard s={s} />;
}

function AddWizard({ s }: { s: TokenizedDepositFormState }): React.JSX.Element {
  const {
    t,
    form,
    onSubmit,
    loading,
    steps,
    wizardSteps,
    currentStep,
    maxReachedStep,
    goToStep,
    handleNextStep,
    handlePreviousStep,
    pageTitle,
    draftBanner,
    restoreDraft,
    discardDraft,
    blockchainList,
    currencyList,
    formValues,
    hasCode,
    detailInfo,
    flag,
    chainType,
    mintMethod,
    symbol,
    currency,
    thresholdType,
    reserveList,
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
    handleTdCoaChangeTracked,
    handleScCoaChangeTracked,
    applyStatus,
    reserveAccountId,
    reserveReconValue,
    keyServiceList,
    keyServiceError,
    resetAdminWalletFields,
    shouldHideKeystoreAndPassword,
    shouldHideGenerateWalletAction,
    isAdminWalletDisabled,
    checkWalletAddress,
    currentTypeLabel,
    currentBlockchainLabel,
    currentContractLabel,
    currentReserveLabel,
    currentKeyServiceLabel,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleReset,
    sharedDialogs,
  } = s;

  const handleFormSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (currentStep !== steps.length - 1) {
        event.preventDefault();
        return;
      }

      void form.handleSubmit(onSubmit)(event);
    },
    [currentStep, form, onSubmit, steps.length],
  );

  return (
    <div className="w-full px-2 py-4 sm:px-4 lg:px-6">
      <Toaster />
      <WizardHeader
        title={pageTitle}
        description={t('td_header_desc')}
      />

      {draftBanner ? (
        <DraftBanner
          text={t('td_draft_banner_text', {
            time: formatDraftTime(draftBanner.savedAt),
          })}
          resumeLabel={t('td_draft_resume')}
          discardLabel={t('td_draft_discard')}
          resumeDisabled={!blockchainList || !currencyList}
          onResume={restoreDraft}
          onDiscard={discardDraft}
        />
      ) : null}

      <main className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <WizardStepper
          steps={wizardSteps}
          current={currentStep}
          maxReached={maxReachedStep}
          onNavigate={goToStep}
          mobileCurrentLabel={`${t('td_form_step_of', {
            current: currentStep + 1,
            total: steps.length,
          })}: ${steps[currentStep]?.title ?? ''}`}
        />
        <form
          id="td-onboard-form"
          onSubmit={handleFormSubmit}
          className={loading ? 'pointer-events-none opacity-60' : ''}
        >
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="w-full p-5 sm:p-8 lg:p-10">
              <div className="mb-8 border-b border-border pb-5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('td_form_step_of', {
                    current: currentStep + 1,
                    total: steps.length,
                  })}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {steps[currentStep].title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {steps[currentStep].sub}
                </p>
              </div>

              {currentStep === 0 ? (
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
                  blockchainList={
                    blockchainList as BlockchainOption[] | undefined
                  }
                  currencyList={currencyList}
                  smartContractNameList={
                    smartContractNameList as SmartContractOption[] | undefined
                  }
                  tokenTypeOptions={tokenTypeOptions ?? []}
                  onBlockchainChange={onBlockchainChange}
                  onCurrencyChange={onCurrencyChange}
                  onTokenTypeChange={onTokenTypeChange}
                />
              ) : null}

              {currentStep === 1 ? (
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
                          : t('td_form_select_token_first')}
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
              ) : null}

              {currentStep === 2 ? (
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
                    shouldHideGenerateWalletAction={
                      shouldHideGenerateWalletAction
                    }
                    isAdminWalletDisabled={isAdminWalletDisabled}
                    onGenerateWallet={checkWalletAddress}
                  />
                </div>
              ) : null}

              {currentStep === 3 ? (
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
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            resetLabel={t('td_reset_application')}
            backLabel={t('td_form_previous')}
            continueLabel={t('td_form_continue')}
            submitLabel={t('PUB_Submit')}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === steps.length - 1}
            loading={loading}
            onReset={() => setResetConfirmOpen(true)}
            onBack={handlePreviousStep}
            onContinue={handleNextStep}
          />
        </form>
      </main>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t('td_autosave_note')}
      </p>

      {sharedDialogs}

      {/* ── Reset 确认 AlertDialog（destructive）── */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('td_reset_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('td_reset_dialog_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('PUB_Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              {t('td_reset_application')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
