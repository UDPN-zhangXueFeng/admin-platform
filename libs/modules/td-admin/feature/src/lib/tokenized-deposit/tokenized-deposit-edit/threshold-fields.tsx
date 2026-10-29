'use client';

import * as React from 'react';
import { Controller, type Control, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access';

const THRESHOLD_TYPES = [
  { value: 'volume', key: 'td_threshold_volume' },
  { value: 'txnCount', key: 'td_threshold_txn_count' },
] as const;
const THRESHOLD_FREQUENCIES = [
  { value: 'daily', key: 'td_threshold_daily' },
  { value: 'monthly', key: 'td_threshold_monthly' },
  { value: 'yearly', key: 'td_threshold_yearly' },
] as const;

/**
 * Significant Stablecoin Issuer Threshold 展示区。
 *
 * 源 TokenBasicInfoSection 在 mintMethod===1 时展示 Volume/TXN Count、
 * Daily/Monthly/Yearly、两位精度数值和 symbol 后缀。该区在新 Admin 中
 * 只读展示，不参与提交 payload；字段仍注册到表单以便 edit 详情/草稿回显。
 */
export function ThresholdFields({
  control,
  symbol,
}: {
  control: Control<TDEditFormValues>;
  symbol?: string;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const thresholdType = useWatch({ control, name: 'thresholdType' }) ?? 'volume';
  return (
    <div className="md:col-span-2 border-t pt-6">
      <h3 className="mb-3 text-sm font-semibold">
        {t('td_threshold_title')}
      </h3>
      <FieldGroup className="flex w-full items-end gap-0">
        <Controller
          control={control}
          name="thresholdType"
          render={({ field }) => (
            <Field className="w-[35%]">
              <FieldLabel htmlFor="select-thresholdType">
                {t('td_threshold_type')}
              </FieldLabel>
              <Select value={field.value ?? 'volume'} disabled>
                <SelectTrigger id="select-thresholdType" className="h-10 w-full rounded-r-none bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          control={control}
          name="thresholdFrequency"
          render={({ field }) => (
            <Field className="w-[30%]">
              <FieldLabel htmlFor="select-thresholdFrequency">
                {t('td_threshold_frequency')}
              </FieldLabel>
              <Select value={field.value ?? 'daily'} disabled>
                <SelectTrigger id="select-thresholdFrequency" className="h-10 w-full rounded-none bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_FREQUENCIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          control={control}
          name="thresholdValue"
          render={({ field }) => (
            <Field className="w-[20%]">
              <FieldLabel htmlFor="field-thresholdValue">
                {t('td_threshold_value')}
              </FieldLabel>
              <div className="flex h-10">
                <Input
                  id="field-thresholdValue"
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value == null ? '' : String(field.value)}
                  disabled
                  readOnly
                  className="rounded-none"
                />
                <span className="inline-flex min-w-16 items-center justify-center rounded-r-md border border-l-0 bg-muted px-2 text-sm text-muted-foreground">
                  {thresholdType === 'volume' ? symbol || '--' : '--'}
                </span>
              </div>
            </Field>
          )}
        />
      </FieldGroup>
    </div>
  );
}
