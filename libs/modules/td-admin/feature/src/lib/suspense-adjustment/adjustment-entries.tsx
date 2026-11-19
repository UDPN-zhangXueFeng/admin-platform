'use client';

import { useTranslations } from 'next-intl';
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Button, Input, SearchableSelect } from '@myorg/shared/ui';
import {
  adjustmentEntryAmount, amountExceeds, formatAmount,
  type AccountOption, type DrCr,
} from '@myorg/modules/td-admin/data-access';

export interface AdjustmentFormValues {
  postingDate: string;
  entries: { accountCode: string; amount: string }[];
  adjustmentReason: string;
}

interface AdjustmentEntriesProps {
  form: UseFormReturn<AdjustmentFormValues>;
  options: AccountOption[];
  direction: DrCr;
  outstanding: string | number;
  currency: string;
  exceeded: boolean;
}

export function AdjustmentEntries({ form, options, direction, outstanding, currency, exceeded }: AdjustmentEntriesProps) {
  const t = useTranslations('modules.suspense-adjustment');
  const { control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });
  const amountExceed = t('edit.amountExceed', { amount: formatAmount(outstanding), currency });
  const selectOptions = options.map((option) => ({ value: option.accountCode, label: option.accountDisplay }));

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[660px] rounded-md border">
          <div className="grid grid-cols-[80px_1.5fr_1fr_80px] bg-muted/30 text-sm font-medium">
            {(['drCr', 'account', 'amount', 'actions'] as const).map((field) => (
              <div className="px-4 py-3" key={field}>{t(`field.${field}`)}{field === 'account' || field === 'amount' ? ' *' : ''}</div>
            ))}
          </div>
          {fields.map((entry, index) => {
            const amountError = index === fields.length - 1 && exceeded ? amountExceed : errors.entries?.[index]?.amount?.message;
            const accountError = errors.entries?.[index]?.accountCode?.message;
            return (
              <div key={entry.id} className="grid grid-cols-[80px_1.5fr_1fr_80px] border-t">
                <div className="px-4 py-3 text-sm">{direction}</div>
                <div className="min-w-0 border-l px-4 py-3">
                  <Controller
                    control={control}
                    name={`entries.${index}.accountCode`}
                    rules={{ validate: (value) => options.some((option) => option.accountCode === value) || t('edit.accountRequired') }}
                    render={({ field }) => (
                      <SearchableSelect
                        options={selectOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('field.account')}
                        searchPlaceholder={t('edit.searchAccounts')}
                        emptyMessage={t('edit.noAccounts')}
                      />
                    )}
                  />
                  {accountError ? <p role="alert" className="mt-1 text-xs text-destructive">{accountError}</p> : null}
                </div>
                <div className="border-l px-4 py-3">
                  <Controller
                    control={control}
                    name={`entries.${index}.amount`}
                    rules={{ validate: (value) => {
                      if (!value) return t('edit.amountRequired');
                      const amount = adjustmentEntryAmount(value);
                      if (!amount) return t('edit.amountInvalid');
                      return !amountExceeds(amount, outstanding) || amountExceed;
                    } }}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Input {...field} inputMode="decimal" aria-label={t('field.amount')} aria-invalid={Boolean(amountError)} />
                        {currency ? <span className="text-sm text-muted-foreground">{currency}</span> : null}
                      </div>
                    )}
                  />
                  {amountError ? <p role="alert" className="mt-1 text-xs text-destructive">{amountError}</p> : null}
                </div>
                <div className="border-l px-4 py-3 text-center">
                  {fields.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" aria-label={t('edit.removeEntry')} onClick={() => remove(index)}>✕</Button>
                  ) : <span className="text-muted-foreground">--</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Button type="button" variant="outline" className="mt-4" onClick={() => append({ accountCode: '', amount: '' })}>{t('edit.addEntry')}</Button>
    </>
  );
}
