/**
 * 存款策略「分段利率」行列表：余额区间（min - max）+ 带正负号的利率。
 * 字段数组由父组件 useFieldArray 持有，这里只负责渲染与行级校验。
 */
'use client';

import * as React from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { Button } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import type { DepositPolicyFormValues } from '@myorg/modules/td-admin/data-access';

import { INTEREST_RATE_PATTERN, MAX_SAVE_DETAILS_ROWS } from './interest.constants';
import { SignedRateInput } from './policy-form-parts';

interface DepositTierRatesProps {
  form: UseFormReturn<DepositPolicyFormValues>;
  fieldArray: UseFieldArrayReturn<DepositPolicyFormValues, 'saveDetails'>;
}

/** 区间 | 利率 | 删除 三列，表头只出现一次，所有行同一网格对齐。 */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-start gap-x-4';
const HEADER_LABEL_CLASS = 'block text-sm font-medium text-foreground';

export function DepositTierRates({ form, fieldArray }: DepositTierRatesProps) {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const { fields, append, remove } = fieldArray;
  const currentSaveDetails = useWatch({ control: form.control, name: 'saveDetails' });
  const rowCount = currentSaveDetails?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className={ROW_GRID}>
        <span className={HEADER_LABEL_CLASS}>{t('interest_0033')}</span>
        <span className={HEADER_LABEL_CLASS}>{t('interest_0006')}</span>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className={ROW_GRID}>
          <div className="flex items-center gap-2 [&_label]:hidden">
            <FormField
              className="min-w-0 flex-1"
              name={`saveDetails.${index}.minValue`}
              label=""
              aria-label={t('interest_0033')}
              type="number"
              register={form.register(`saveDetails.${index}.minValue`, {
                required: tc('PUB_Pleased').replace('****', t('interest_0033')),
                validate: (value, formValues) => {
                  const current = formValues.saveDetails?.[index];
                  const previous = formValues.saveDetails?.[index - 1];
                  if (current?.maxValue && Number(value) >= Number(current.maxValue))
                    return t('interest_00120');
                  if (previous && Number(value) < Number(previous.maxValue))
                    return t('interest_00121');
                  return true;
                },
              })}
            />
            <span className="text-muted-foreground">-</span>
            <FormField
              className="min-w-0 flex-1"
              name={`saveDetails.${index}.maxValue`}
              label=""
              aria-label={t('interest_0033')}
              type="number"
              register={form.register(`saveDetails.${index}.maxValue`, {
                required: tc('PUB_Pleased').replace('****', t('interest_0033')),
                validate: (value, formValues) => {
                  const current = formValues.saveDetails?.[index];
                  if (current && Number(value) <= Number(current.minValue))
                    return t('interest_00122');
                  return true;
                },
              })}
            />
          </div>

          <SignedRateInput
            control={form.control}
            signName={`saveDetails.${index}.type`}
            rateName={`saveDetails.${index}.interestRate`}
            rateRegister={form.register(`saveDetails.${index}.interestRate`, {
              required: tc('PUB_Pleased').replace('****', t('interest_0006')),
              pattern: { value: INTEREST_RATE_PATTERN, message: t('interest_0057') },
            })}
            label={t('interest_0006')}
            showLabel={false}
          />

          {rowCount > 1 && rowCount === index + 1 && (
            <button
              type="button"
              aria-label={tc('delete')}
              className="flex h-10 items-center justify-center text-red-500"
              onClick={() => remove(index)}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {rowCount < MAX_SAVE_DETAILS_ROWS && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => append({ interestRate: '', maxValue: '', minValue: '', type: t('interest_00118') })}
        >
          {tc('PUB_Add')}
        </Button>
      )}
    </div>
  );
}
