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
import type { PostToSuspenseFormValues } from '@myorg/modules/chart-of-accounts/data-access';

/** Post to Suspense 配置（不平衡金额、账户选项，由上层计算）。 */
export interface PostToSuspenseConfig {
  totalAssets?: string | number;
  totalLiabilities?: string | number;
  amount?: string | number;
  currency?: string;
  directionText?: string;
  debitOptions?: { label: string; value: string }[];
  creditOptions?: { label: string; value: string }[];
}

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
 * Post to Suspense Dialog（迁移自源 PostToSuspenseModal.tsx）。
 * 高风险操作提示 + 不平衡金额展示 + 调整分录表单（RHF）。
 * 注：源 onFinish={onCancel}，提交逻辑未接后端；这里 onSubmit 由上层决定（暂 onClose）。
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
  const { register, handleSubmit, control, reset } = useForm<PostToSuspenseFormValues>({
    defaultValues: {},
  });

  useEffect(() => {
    if (open) reset({});
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
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
              <div className="text-xs text-muted-foreground">{t('eod.totalAssets')}</div>
              <div className="text-lg font-semibold">{config?.totalAssets ?? '--'}</div>
            </div>
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <div className="text-xs text-muted-foreground">{t('eod.totalLiabilities')}</div>
              <div className="text-lg font-semibold">{config?.totalLiabilities ?? '--'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="text-sm font-medium text-red-600">{t('eod.unbalancedAmount')}</div>
            <div className="text-lg font-semibold text-red-600">
              {config ? `${config.amount} ${config.currency ?? currency}` : '--'}
              {config?.directionText ? (
                <span className="ml-1 text-sm font-medium">{config.directionText}</span>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div className="text-sm font-semibold">{t('eod.proposedAdjustment')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormDatePicker name="postingDate" control={control} label={t('eod.postingDate')} />
              <div className="space-y-1">
                <Label>{t('eod.amount')}</Label>
                <div className="flex items-center">
                  <input
                    {...register('amount', { required: true })}
                    className="flex h-9 w-full rounded-l-md border bg-background px-3 text-sm"
                  />
                  <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm">
                    {config?.currency ?? currency}
                  </span>
                </div>
              </div>
              <FormSelect
                name="debitAccount"
                control={control}
                label={t('eod.debitAccount')}
                options={config?.debitOptions ?? []}
              />
              <FormSelect
                name="creditAccount"
                control={control}
                label={t('eod.creditAccount')}
                options={config?.creditOptions ?? []}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('eod.transactionId')}</Label>
              <input
                {...register('transactionId', { required: true })}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label>{t('eod.reason')}</Label>
              <textarea
                {...register('reason', { required: true })}
                rows={4}
                maxLength={200}
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
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
