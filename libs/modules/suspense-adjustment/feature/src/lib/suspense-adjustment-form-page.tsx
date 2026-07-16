'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import {
  getOffsettingEntryFor,
  getSuspenseAccountLine,
  useSubmitSuspenseAdjustmentMutation,
  useSuspenseEntryDetailQuery,
  useTxAccountsLeafQuery,
  type AccountBrief,
  type AccountOption,
  type NewAdjustmentForm,
} from '@myorg/modules/suspense-adjustment/data-access';
import {
  ADJUSTMENT_REASON_MAX_LENGTH,
  calculateRemainingAfter,
  calculateThisAdjustment,
  formatAmount,
  getDefaultPostingDate,
  getOffsettingDirection,
  textOrDash,
} from '@myorg/modules/suspense-adjustment/util';
import type { DrCr } from '@myorg/modules/suspense-adjustment/util';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** entries 表单行值（drCr 固定 entryDirection，不存表单，提交时注入）。 */
interface EntryFormValue {
  accountCode: string;
  accountName: string;
  accountDisplay: string;
  amount: number | null;
  currency: string;
}

interface AdjustmentFormValues {
  postingDate: string;
  entries: EntryFormValue[];
  adjustmentReason: string;
}

const makeEmptyEntry = (currency: string): EntryFormValue => ({
  accountCode: '',
  accountName: '',
  accountDisplay: '',
  amount: null,
  currency,
});

const mapAccountBriefToOption = (
  account: AccountBrief,
  currency: string,
): AccountOption => ({
  accountCode: account.accountCode ?? '',
  accountName: account.accountName ?? '',
  accountDisplay: `${account.accountCode ?? ''} - ${
    account.accountName ?? ''
  }`.trim(),
  currency,
});

/**
 * SuspenseAdjustmentFormPage — New Adjustment Entry 调账页。
 *
 * 迁移自 td-manage src/pages/financial/adjustments/edit.tsx（915 行）。
 * 区块：Overview（原始/已清/未清）+ Basic Information 只读 + New Adjustment Entry
 * 表单（postingDate / offsettingEntryFor 只读 / useFieldArray 动态 entries[accountCode
 * Select + amount] / Add）+ Adjustment Reason（TextArea, max 1000）+ Adjustment Summary
 *（thisAdjustment / remainingAfter, =0 绿）+ Submit。
 *
 * 路由：/suspense-adjustment/edit?id=suspenseRecordId&suspenseTxnId=。
 */
export function SuspenseAdjustmentFormPage() {
  const t = useTranslations('modules.suspense-adjustment');
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspenseRecordId = parseId(searchParams.get('id'));
  const suspenseTxnIdFromQuery = searchParams.get('suspenseTxnId') ?? '';

  const { data: detail, isLoading } =
    useSuspenseEntryDetailQuery(suspenseRecordId);

  const suspenseLine = detail ? getSuspenseAccountLine(detail) : undefined;
  const suspenseDrCr: DrCr = suspenseLine?.drCr ?? 'Dr';
  // entries 行方向 = 暂记方向（与 offsetting 相反）；等价源二次 getOffsettingDirection。
  const entryDirection: DrCr = getOffsettingDirection(
    getOffsettingDirection(suspenseDrCr),
  );
  const offsettingEntryFor = detail ? getOffsettingEntryFor(detail) : '';

  const accountsLeaf = useTxAccountsLeafQuery(detail?.financeBookId);
  const accountOptions = React.useMemo<AccountOption[]>(() => {
    const currency = detail?.currency ?? '';
    const list =
      entryDirection === 'Dr'
        ? accountsLeaf.data?.debitAccounts
        : accountsLeaf.data?.creditAccounts;
    return (list ?? [])
      .filter((a) => a.accountCode)
      .map((a) => mapAccountBriefToOption(a, currency));
  }, [accountsLeaf.data, entryDirection, detail?.currency]);

  const overview = React.useMemo(
    () => ({
      originalAmount: detail?.originalAmount ?? 0,
      totalAdjusted: detail?.totalAdjusted ?? 0,
      outstandingAmount: detail?.outstandingAmount ?? 0,
      currency: detail?.currency ?? '',
    }),
    [detail],
  );

  const { control, handleSubmit, reset, watch, setValue, formState } =
    useForm<AdjustmentFormValues>({
      defaultValues: {
        postingDate: '',
        entries: [makeEmptyEntry('')],
        adjustmentReason: '',
      },
    });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'entries',
  });

  // detail 加载后 reset 默认值。
  React.useEffect(() => {
    if (detail) {
      reset({
        postingDate: getDefaultPostingDate(detail),
        entries: [makeEmptyEntry(overview.currency)],
        adjustmentReason: '',
      });
    }
  }, [detail, overview.currency, reset]);

  const entries = watch('entries') ?? [];
  const thisAdjustment = calculateThisAdjustment(entries);
  const remainingAfterThis = calculateRemainingAfter(
    overview.outstandingAmount,
    thisAdjustment,
  );
  const isFullyCleared = remainingAfterThis === 0;
  const exceeded = thisAdjustment > overview.outstandingAmount;

  const submitMutation = useSubmitSuspenseAdjustmentMutation();

  const onSubmit = handleSubmit((values) => {
    if (!detail || suspenseRecordId == null || exceeded) return;
    const payload: NewAdjustmentForm = {
      suspenseRecordId,
      suspenseTxnId: detail.suspenseTxnId || suspenseTxnIdFromQuery,
      postingDate: values.postingDate,
      offsettingEntryFor,
      entries: values.entries.map((e, i) => ({
        rowId: `entry-${i}`,
        postingDate: values.postingDate,
        drCr: entryDirection,
        accountCode: e.accountCode,
        accountName: e.accountName,
        accountDisplay: e.accountDisplay,
        amount: e.amount,
        currency: e.currency,
      })),
      adjustmentReason: values.adjustmentReason,
    };
    submitMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('edit.submitSuccess'));
        router.push(`/suspense-adjustment/view?id=${suspenseRecordId}`);
      },
      onError: () => toast.error(t('edit.submitFailed')),
    });
  });

  if (!suspenseRecordId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        {isLoading ? '' : t('empty')}
      </div>
    );
  }

  const reasonValue = watch('adjustmentReason') ?? '';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Overview */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
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
      </section>

      {/* Basic Information 只读 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('edit.basicInfo')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.suspenseTxnId')}
            </label>
            <Input disabled value={textOrDash(detail.suspenseTxnId)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.sourceType')}</label>
            <Input disabled value={textOrDash(detail.sourceTypeLabel)} />
          </div>
        </div>
      </section>

      {/* New Adjustment Entry 表单 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('edit.title')}</div>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.postingDate')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="postingDate"
              rules={{ required: true }}
              render={({ field }) => <Input type="date" {...field} />}
            />
            {formState.errors.postingDate ? (
              <p className="text-xs text-red-500">{t('field.postingDate')}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('edit.offsettingEntryFor')}
            </label>
            <Input disabled value={offsettingEntryFor} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px] overflow-hidden rounded-md border">
            <div className="grid grid-cols-[80px_1.5fr_1fr_80px] bg-muted/30">
              <div className="px-4 py-3 text-sm font-medium">
                {t('field.drCr')}
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('field.account')}
                <span className="text-red-500">*</span>
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('field.amount')}
                <span className="text-red-500">*</span>
              </div>
              <div className="border-l px-4 py-3 text-center text-sm font-medium">
                {t('field.actions')}
              </div>
            </div>
            {fields.map((entry, index) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[80px_1.5fr_1fr_80px] ${
                  index === 0 ? '' : 'border-t'
                }`}
              >
                <div className="px-4 py-3">
                  <Input disabled value={entryDirection} />
                </div>
                <div className="border-l px-4 py-3">
                  <Controller
                    control={control}
                    name={`entries.${index}.accountCode`}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          const opt = accountOptions.find(
                            (o) => o.accountCode === val,
                          );
                          field.onChange(val);
                          if (opt) {
                            setValue(
                              `entries.${index}.accountName`,
                              opt.accountName,
                            );
                            setValue(
                              `entries.${index}.accountDisplay`,
                              opt.accountDisplay,
                            );
                            setValue(
                              `entries.${index}.currency`,
                              opt.currency,
                            );
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('field.account')} />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map((o) => (
                            <SelectItem
                              key={o.accountCode}
                              value={o.accountCode}
                            >
                              {o.accountDisplay}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="border-l px-4 py-3">
                  <Controller
                    control={control}
                    name={`entries.${index}.amount`}
                    rules={{ required: true, min: 0.01 }}
                    render={({ field }) => (
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                      />
                    )}
                  />
                </div>
                <div className="border-l px-4 py-3 text-center">
                  {fields.length <= 1 ? (
                    <span className="text-muted-foreground">--</span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {exceeded ? (
          <p className="mt-2 text-xs text-red-500">
            {t('edit.amountExceed', {
              amount: overview.outstandingAmount.toFixed(2),
              currency: overview.currency,
            })}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => append(makeEmptyEntry(overview.currency))}
        >
          {t('edit.addEntry')}
        </Button>
      </section>

      {/* Adjustment Reason + Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 text-sm font-semibold">
            {t('edit.reason')}
            <span className="text-red-500">*</span>
          </div>
          <Controller
            control={control}
            name="adjustmentReason"
            rules={{
              required: true,
              maxLength: ADJUSTMENT_REASON_MAX_LENGTH,
            }}
            render={({ field }) => (
              <textarea
                className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                maxLength={ADJUSTMENT_REASON_MAX_LENGTH}
                placeholder={t('edit.reasonPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">
            {reasonValue.length}/{ADJUSTMENT_REASON_MAX_LENGTH}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
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
        </section>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitMutation.isPending}
        >
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={exceeded || submitMutation.isPending}>
          {t('action.submit')}
        </Button>
      </div>
    </form>
  );
}
