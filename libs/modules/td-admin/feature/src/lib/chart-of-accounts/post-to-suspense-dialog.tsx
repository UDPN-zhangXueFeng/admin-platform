'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import type {
  PostToSuspenseConfig,
  PostToSuspenseFormValues,
} from '@myorg/modules/td-admin/data-access';

export type { PostToSuspenseConfig };

export interface PostToSuspenseDialogProps {
  open: boolean;
  config: PostToSuspenseConfig | null;
  currency: string;
  title: string;
  t: (key: string) => string;
  onSubmit: (values: PostToSuspenseFormValues) => void;
  onCancel: () => void;
}

/**
 * Post to Suspense Dialog（迁移自源 `PostToSuspenseModal.tsx`）。
 *
 * 高风险操作提示 + Total Assets / Total Liabilities + 不平衡金额与方向 +
 * 调整分录表单（Posting Date / Amount / Debit / Credit / Transaction ID / Reason）。
 * 表单默认值来自 `config`（选中 EOD 行金额 + COA 可过账科目），与源
 * `postToSuspenseForm.setFieldsValue` 行为一致。提交逻辑源为空实现，
 * 这里由上层 `onSubmit` 决定（当前仅关闭）。
 */
export function PostToSuspenseDialog({
  open,
  config,
  currency,
  title,
  t,
  onSubmit,
  onCancel,
}: PostToSuspenseDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<PostToSuspenseFormValues>({ defaultValues: {} });

  // FormDatePicker / FormSelect 不接 RHF rules，date / 账户三项在此显式校验（源 required 规则）。
  const submit = (values: PostToSuspenseFormValues) => {
    clearErrors(['postingDate', 'debitAccount', 'creditAccount']);
    let invalid = false;
    if (!values.postingDate) {
      setError('postingDate', { message: t('eod.postingDateRequired') });
      invalid = true;
    }
    if (!values.debitAccount) {
      setError('debitAccount', { message: t('eod.debitAccountRequired') });
      invalid = true;
    }
    if (!values.creditAccount) {
      setError('creditAccount', { message: t('eod.creditAccountRequired') });
      invalid = true;
    }
    if (invalid) return;
    onSubmit(values);
  };

  useEffect(() => {
    if (!open) return;
    reset({
      postingDate: config?.postingDate ?? '',
      amount: config?.amount ?? '',
      debitAccount: config?.defaultDebitAccount ?? '',
      creditAccount: config?.defaultCreditAccount ?? '',
      transactionId: '',
      reason: '',
    });
  }, [open, config, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-auto">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t('eod.postToSuspenseWarning')}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <div className="text-xs text-muted-foreground">
                {t('eod.totalAssets')}
              </div>
              <div className="text-lg font-semibold">
                {config?.totalAssets ?? '--'}
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <div className="text-xs text-muted-foreground">
                {t('eod.totalLiabilities')}
              </div>
              <div className="text-lg font-semibold">
                {config?.totalLiabilities ?? '--'}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="text-sm font-medium text-red-600">
              {t('eod.unbalancedAmount')}
            </div>
            <div className="text-lg font-semibold text-red-600">
              {config ? `${config.amount} ${config.currency ?? currency}` : '--'}
              {config?.directionText ? (
                <span className="ml-1 text-sm font-medium">
                  {config.directionText}
                </span>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit(submit)} className="mt-4 space-y-4">
            <div className="text-sm font-semibold">
              {t('eod.proposedAdjustment')}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormDatePicker
                name="postingDate"
                control={control}
                label={t('eod.postingDate')}
                required
                error={errors.postingDate?.message}
              />
              <div className="space-y-1">
                <Label>
                  {t('eod.amount')}
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="flex items-center">
                  <input
                    {...register('amount', {
                      required: t('eod.amountRequired'),
                    })}
                    aria-invalid={!!errors.amount}
                    className="flex h-9 w-full rounded-l-md border bg-background px-3 text-sm"
                  />
                  <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm">
                    {config?.currency ?? currency}
                  </span>
                </div>
                {errors.amount?.message ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.amount.message}
                  </p>
                ) : null}
              </div>
              <FormSelect
                name="debitAccount"
                control={control}
                label={t('eod.debitAccount')}
                options={config?.debitOptions ?? []}
                required
                error={errors.debitAccount?.message}
              />
              <FormSelect
                name="creditAccount"
                control={control}
                label={t('eod.creditAccount')}
                options={config?.creditOptions ?? []}
                required
                error={errors.creditAccount?.message}
              />
            </div>

            <div className="space-y-1">
              <Label>
                {t('eod.transactionId')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <input
                {...register('transactionId', {
                  required: t('eod.transactionIdRequired'),
                })}
                aria-invalid={!!errors.transactionId}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
              {errors.transactionId?.message ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.transactionId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>
                {t('eod.reason')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <textarea
                {...register('reason', {
                  required: t('eod.reasonRequired'),
                })}
                aria-invalid={!!errors.reason}
                rows={4}
                maxLength={200}
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              {errors.reason?.message ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.reason.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.confirm')}</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
