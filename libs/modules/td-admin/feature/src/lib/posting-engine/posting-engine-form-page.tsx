'use client';

import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { addDays, isValid, parseISO, startOfDay } from 'date-fns';
import {
  Button, Card, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  usePostingEventAccountsQuery, usePostingEventDetailQuery, useUpdatePostingEventMutation,
  type PostingAccountOption, type PostingEvent,
} from '@myorg/modules/td-admin/data-access';
import {
  DIRECTION, DEFAULT_AMOUNT_EXPRESSION, EMPTY_DISPLAY, directionLabel, formatAccountLabel, getSourceEventTypeMessageKey,
  mappingMethodMessageKey, parsePostingId, toMillis,
} from './posting-engine.constants';
import { PostingEventFields } from './posting-information';

const DATE_FMT = 'yyyy-MM-dd';
const HEADERS = ['drCr', 'account', 'method', 'value'] as const;
const accountKey = (code: string, name: string) => JSON.stringify([code, name]);

function buildAccountOptions(accounts: PostingAccountOption[]) {
  return new Map(accounts.flatMap(({ accountCode, accountName }) => accountCode
    ? [[accountKey(accountCode, accountName ?? ''), { accountCode, accountName: accountName ?? '' }] as const]
    : []));
}

function tomorrow() {
  return startOfDay(addDays(new Date(), 1));
}

export function PostingEngineFormPage() {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const id = parsePostingId(useSearchParams().get('id'));
  const { data: event, isError, isLoading } = usePostingEventDetailQuery(id);
  if (id && event) return <PostingMatrixForm key={id} id={id} event={event} />;
  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground">{t(!id ? 'detail.invalidId' : isLoading ? 'loading' : isError ? 'loadError' : 'empty')}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={() => router.back()}>{t('action.back')}</Button>
    </Card>
  );
}

function PostingMatrixForm({ id, event: initialEvent }: { id: number; event: PostingEvent }) {
  // Hold the event version the user opened; a focus refetch must not reorder their draft rows.
  const [event] = useState(initialEvent);
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const toast = useToast();
  const debit = usePostingEventAccountsQuery(id, DIRECTION.Debit, true);
  const credit = usePostingEventAccountsQuery(id, DIRECTION.Credit, true);
  const update = useUpdatePostingEventMutation();
  const inFlight = useRef(false);
  const rows = (event.mappings ?? []).slice().sort((a, b) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.direction ?? 0) - (b.direction ?? 0)
  );
  const effectiveDate = toMillis(event.effectiveDate);
  const { control, register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      effectiveDate: effectiveDate ? formatDate(effectiveDate, DATE_FMT) : '',
      accounts: rows.map((row) => row.accountCode ? accountKey(row.accountCode, row.accountName ?? '') : ''),
    },
  });

  const optionsByRow = rows.map((row) => {
    const result = row.direction === DIRECTION.Debit ? debit : row.direction === DIRECTION.Credit ? credit : undefined;
    const options = buildAccountOptions(result?.data ?? []);
    if (row.accountCode) {
      const accountName = row.accountName ?? '';
      const key = accountKey(row.accountCode, accountName);
      if (!options.has(key)) options.set(key, { accountCode: row.accountCode, accountName });
    }
    return { result, options };
  });
  const source = event.sourceEventType || event.eventType;
  const sourceKey = getSourceEventTypeMessageKey(source, event.tokenType);
  const fields = (event.normalizedTargetFields ?? [])
    .map(({ targetField, sourceField }) => targetField || sourceField)
    .filter((value): value is string => Boolean(value));
  const canSubmit = rows.length > 0 && rows.every((row) =>
    Boolean(directionLabel(row.direction) && mappingMethodMessageKey(row.mappingMethod))
  );

  const onSubmit = handleSubmit(async (values) => {
    if (inFlight.current || !canSubmit) return;
    const mappings = rows.map((row, index) => ({
      ...optionsByRow[index].options.get(values.accounts[index]),
      postingEventId: id,
      direction: row.direction,
      mappingMethod: row.mappingMethod,
      amountExpression: row.amountExpression || DEFAULT_AMOUNT_EXPRESSION,
      sortOrder: index + 1,
    }));
    if (!mappings.every((row): row is typeof row & { accountCode: string; accountName: string; mappingMethod: number } =>
      Boolean(row.accountCode) && typeof row.accountName === 'string' && row.mappingMethod !== undefined
    )) return;
    inFlight.current = true;
    try {
      await update.mutateAsync({
        postingEventId: id,
        eventCode: event.eventCode,
        eventType: event.eventType,
        versionId: event.versionId,
        remarks: event.remarks,
        effectiveDate: startOfDay(parseISO(values.effectiveDate)).getTime(),
        mappings,
      });
      toast.success(t('edit.submitSuccess'));
      router.back();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('edit.submitError'));
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Card className="p-6">
        <h2 className="mb-6 text-base font-semibold">{t('edit.title')}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-sm font-medium">
            <span>{t('detail.sourceEventType')}</span>
            <Input disabled value={event.eventTypeName || (sourceKey ? t(sourceKey) : source ?? EMPTY_DISPLAY)} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>{t('edit.effectiveDate')} <span className="text-destructive">*</span></span>
            <Input type="date" required min={formatDate(tomorrow(), DATE_FMT)} aria-invalid={Boolean(errors.effectiveDate)}
              aria-describedby="posting-effective-help" {...register('effectiveDate', {
                required: t('validation.required'),
                validate: (value) => {
                  const date = parseISO(value);
                  return (isValid(date) && date >= tomorrow()) || t('edit.effectiveDateAfterToday');
                },
              })} />
            <span id="posting-effective-help" className={errors.effectiveDate ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {errors.effectiveDate?.message ?? t('edit.effectiveDateHelp')}
            </span>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>{t('field.bookName')}</span>
            <Input disabled value={event.bookName || event.financialBookName || EMPTY_DISPLAY} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>{t('field.currency')}</span>
            <Input disabled value={event.currencyCode || event.accountCurrency || EMPTY_DISPLAY} />
          </label>
        </div>
      </Card>
      <PostingEventFields title={t('detail.transactionEventFields')} fields={fields} emptyMessage={t('empty')} />
      <Card>
        <h2 className="border-b px-6 py-3 text-sm font-semibold">{t('edit.entryTemplate')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead><tr className="bg-muted/30 text-left">
              {HEADERS.map((key) => <th scope="col" className="border px-4 py-3 font-medium" key={key}>{t(`edit.${key}`)}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const methodKey = mappingMethodMessageKey(row.mappingMethod);
                const direction = directionLabel(row.direction);
                const { result, options } = optionsByRow[index];
                return (
                  <tr key={index}>
                    <td className="border px-4 py-3"><Input aria-label={t('edit.drCr')} disabled value={direction || EMPTY_DISPLAY} /></td>
                    <td className="min-w-64 border px-4 py-3">
                      <Controller control={control} name={`accounts.${index}`}
                        rules={{ validate: (value) => options.has(value) || t('validation.required') }}
                        render={({ field, fieldState }) => (
                          <>
                            <Select value={field.value} onValueChange={field.onChange}
                              onOpenChange={(open) => { if (open && result?.isError && !result.isFetching) void result.refetch(); }}
                              disabled={!direction || update.isPending}>
                              <SelectTrigger ref={field.ref} onBlur={field.onBlur} aria-label={`${t('edit.account')} ${direction} ${index + 1}`}
                                aria-invalid={Boolean(fieldState.error)}>
                                <SelectValue placeholder={t('edit.account')} />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(options, ([key, option]) => (
                                  <SelectItem key={key} value={key}>{formatAccountLabel(option.accountCode, option.accountName)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
                            {result?.isError && <p className="text-xs text-destructive">{t('edit.accountsError')}</p>}
                            {result?.isFetching && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
                          </>
                        )} />
                    </td>
                    <td className="border px-4 py-3"><Input aria-label={t('edit.method')} disabled value={methodKey ? t(methodKey) : EMPTY_DISPLAY} /></td>
                    <td className="border px-4 py-3"><Input aria-label={t('edit.value')} disabled title={row.amountExpression} value={row.amountExpression || DEFAULT_AMOUNT_EXPRESSION} /></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t('empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={update.isPending}>{t('action.back')}</Button>
        <Button type="submit" disabled={!canSubmit || update.isPending}>{t('action.save')}</Button>
      </div>
    </form>
  );
}
