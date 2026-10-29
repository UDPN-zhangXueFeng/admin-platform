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
} from '@myorg/shared/ui';
import { formatDraftTime } from '@myorg/modules/td-admin/data-access';

import {
  WizardHeader,
  DraftBanner,
  WizardStepper,
  WizardFooter,
} from './tokenized-deposit-edit/ui/onboard-wizard';
import {
  AddStepBasicInfo,
  AddStepFinance,
  AddStepCustody,
  AddStepReview,
} from './tokenized-deposit-edit/ui/add-wizard-steps';
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
 *
 * 4 步分步内容拆至 `tokenized-deposit-edit/ui/add-wizard-steps.tsx`（≤300 行重构）。
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

              {currentStep === 0 ? <AddStepBasicInfo s={s} /> : null}

              {currentStep === 1 ? <AddStepFinance s={s} /> : null}

              {currentStep === 2 ? <AddStepCustody s={s} /> : null}

              {currentStep === 3 ? <AddStepReview s={s} /> : null}
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
