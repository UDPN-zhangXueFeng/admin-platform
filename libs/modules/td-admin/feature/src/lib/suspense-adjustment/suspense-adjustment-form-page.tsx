'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import { Button, Card, Input } from '@myorg/shared/ui';

import {
  ADJUSTMENT_REASON_MAX_LENGTH,
  CLEAR_STATUS_MAP,
  amountExceeds,
  calculateRemainingAfter,
  calculateThisAdjustment,
  formatAmount,
  getDefaultPostingDate,
  getOffsettingDirection,
  mapClearStatus,
  getOffsettingEntryFor,
  getSuspenseAccountLine,
  useSubmitSuspenseAdjustmentMutation,
  useSuspenseEntryDetailQuery,
  useTxAccountsLeafQuery,
  type AccountBrief,
  type AccountOption,
  type DrCr,
  type NewAdjustmentForm,
} from '@myorg/modules/td-admin/data-access';
import { SuspenseEntriesDetails } from './suspense-entries-details';
import { AdjustmentEntries, type AdjustmentFormValues } from './adjustment-entries';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const mapAccountBriefToOption = (account: AccountBrief, currency: string): AccountOption => ({
  accountCode: account.accountCode ?? '',
  accountName: account.accountName ?? '',
  accountDisplay: `${account.accountCode ?? ''} - ${account.accountName ?? ''}`.trim(),
  currency,
});

export function SuspenseAdjustmentFormPage() {
  const t = useTranslations('modules.suspense-adjustment');
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspenseRecordId = parseId(searchParams.get('id'));
  const suspenseTxnIdFromQuery = searchParams.get('suspenseTxnId') ?? '';
  const statusFromQuery = mapClearStatus(searchParams.get('status'));
  const statusLabelFromQuery = searchParams.get('statusLabel');
  const ageFromQuery = searchParams.get('age');
  const displayAge = ageFromQuery?.trim() ? Number(ageFromQuery) : undefined;

  const { data: detail, isLoading, error } = useSuspenseEntryDetailQuery(suspenseRecordId);
  const suspenseLine = detail ? getSuspenseAccountLine(detail) : undefined;
  const offsettingEntryFor = detail?.offsettingEntryFor || (detail ? getOffsettingEntryFor(detail) : '');
  const offsettingDirection = /^(Dr|Cr)\b/.exec(offsettingEntryFor.trim())?.[1] as DrCr | undefined;
  const entryDirection = offsettingDirection ? getOffsettingDirection(offsettingDirection) : suspenseLine?.drCr ?? 'Dr';

  const accountsLeaf = useTxAccountsLeafQuery(detail?.financeBookId);
  const accountOptions = React.useMemo<AccountOption[]>(() => {
    const currency = detail?.currency ?? '';
    const { debitAccounts, creditAccounts } = accountsLeaf.data ?? {};
    const [primary, fallback] = entryDirection === 'Dr' ? [debitAccounts, creditAccounts] : [creditAccounts, debitAccounts];
    const list = primary?.length ? primary : fallback;
    return (list ?? [])
      .filter((a) => a.accountCode)
      .map((a) => mapAccountBriefToOption(a, currency));
  }, [accountsLeaf.data, entryDirection, detail?.currency]);

  const overview = {
    originalAmount: detail?.originalAmount ?? 0,
    totalAdjusted: detail?.totalAdjusted ?? 0,
    outstandingAmount: detail?.outstandingAmount ?? 0,
    currency: detail?.currency ?? '',
  };

  const form = useForm<AdjustmentFormValues>({
    mode: 'onBlur',
    defaultValues: { postingDate: '', entries: [{ accountCode: '', amount: '' }], adjustmentReason: '' },
  });
  const { control, handleSubmit, reset, watch, setError, formState } = form;
  const defaultPostingDate = detail ? getDefaultPostingDate(detail) : '';

  React.useEffect(() => {
    if (defaultPostingDate) {
      reset({ postingDate: defaultPostingDate, entries: [{ accountCode: '', amount: '' }], adjustmentReason: '' });
    }
  }, [defaultPostingDate, suspenseRecordId, reset]);

  const entries = watch('entries') ?? [];
  const thisAdjustment = calculateThisAdjustment(entries);
  const remainingAfterThis = calculateRemainingAfter(overview.outstandingAmount, thisAdjustment);
  const isFullyCleared = remainingAfterThis === '0' && amountExceeds(thisAdjustment, 0);
  const exceeded = amountExceeds(thisAdjustment, overview.outstandingAmount);

  const submitMutation = useSubmitSuspenseAdjustmentMutation();

  const onSubmit = handleSubmit((values) => {
    if (!detail || suspenseRecordId == null || exceeded) return;
    const payload: NewAdjustmentForm = {
      suspenseRecordId,
      suspenseTxnId: detail.suspenseTxnId || suspenseTxnIdFromQuery,
      postingDate: values.postingDate,
      offsettingEntryFor,
      entries: [],
      adjustmentReason: values.adjustmentReason,
    };
    for (const [index, entry] of values.entries.entries()) {
      const option = accountOptions.find((account) => account.accountCode === entry.accountCode);
      if (!option) {
        setError(`entries.${index}.accountCode`, { message: t('edit.accountRequired') });
        return;
      }
      payload.entries.push({ ...option, rowId: `entry-${index}`, postingDate: values.postingDate, drCr: entryDirection, amount: entry.amount });
    }
    submitMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('edit.submitSuccess'));
        router.push(`/accounting/suspense-adjustment/view?id=${suspenseRecordId}`);
      },
      onError: (failure) => toast.error(failure.message || t('edit.submitFailed')),
    });
  });

  if (!suspenseRecordId) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>{t('action.back')}</Button>
      </Card>
    );
  }

  if (isLoading || !detail) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {isLoading ? t('loading') : error?.message || t('empty')}
      </Card>
    );
  }

  const reasonValue = watch('adjustmentReason') ?? '';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 text-sm font-semibold">{t('edit.overview')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">
              {t('field.originalAmount')}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {formatAmount(overview.originalAmount, overview.currency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {t('field.totalAdjusted')}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {formatAmount(overview.totalAdjusted, overview.currency)}
            </div>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() =>
                router.push(
                  `/accounting/suspense-adjustment/view?id=${suspenseRecordId}`,
                )
              }
            >
              {t('action.viewDetails')}
            </Button>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {t('field.outstandingAmount')}
            </div>
            <div className="mt-1 text-lg font-semibold text-red-600">
              {formatAmount(overview.outstandingAmount, overview.currency)}
            </div>
          </div>
        </div>
      </Card>

      <SuspenseEntriesDetails
        detail={detail}
        status={statusFromQuery ?? detail.status}
        statusLabel={statusLabelFromQuery ?? CLEAR_STATUS_MAP[detail.status].label}
        age={displayAge != null && Number.isFinite(displayAge) ? displayAge : detail.age}
      />

      <Card className="p-6">
        <div className="mb-4 text-sm font-semibold">{t('edit.title')}</div>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="adjustment-posting-date" className="text-sm font-medium">
              {t('field.postingDate')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="postingDate"
              rules={{ required: t('edit.dateRequired') }}
              render={({ field }) => <Input id="adjustment-posting-date" type="date" {...field} />}
            />
            {formState.errors.postingDate ? (
              <p role="alert" className="text-xs text-destructive">{formState.errors.postingDate.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="adjustment-offsetting-entry" className="text-sm font-medium">
              {t('edit.offsettingEntryFor')}
            </label>
            <Input id="adjustment-offsetting-entry" disabled value={offsettingEntryFor} />
          </div>
        </div>

        {accountsLeaf.error ? <p role="alert" className="mb-3 text-sm text-destructive">{accountsLeaf.error.message}</p> : null}
        <AdjustmentEntries form={form} options={accountOptions} direction={entryDirection} outstanding={overview.outstandingAmount} currency={overview.currency} exceeded={exceeded} />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 text-sm font-semibold">
            {t('edit.reason')}
            <span className="text-red-500">*</span>
          </div>
          <Controller
            control={control}
            name="adjustmentReason"
            rules={{
              validate: (value) => Boolean(value.trim()) || t('edit.reasonRequired'),
              maxLength: ADJUSTMENT_REASON_MAX_LENGTH,
            }}
            render={({ field }) => (
              <textarea
                className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                maxLength={ADJUSTMENT_REASON_MAX_LENGTH}
                aria-label={t('edit.reason')}
                placeholder={t('edit.reasonPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {formState.errors.adjustmentReason ? <p role="alert" className="text-xs text-destructive">{formState.errors.adjustmentReason.message}</p> : null}
          <div className="mt-1 text-right text-xs text-muted-foreground">
            {reasonValue.length}/{ADJUSTMENT_REASON_MAX_LENGTH}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 text-sm font-semibold">{t('edit.summary')}</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">
                {t('edit.thisAdjustment')}
              </div>
              <div className="mt-1 text-sm">
                {formatAmount(thisAdjustment, overview.currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {t('edit.remainingAfter')}
              </div>
              <div
                className={`mt-1 text-sm ${
                  isFullyCleared ? 'font-medium text-green-600' : ''
                }`}
              >
                {formatAmount(remainingAfterThis, overview.currency)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitMutation.isPending}>
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={exceeded || submitMutation.isPending}>
          {t('action.submit')}
        </Button>
      </div>
    </form>
  );
}
