'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import type {
  CurrencyOption,
  ReserveAccountOption,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access';
import { Required } from './ui/section-card';

/**
 * TokenPricingReserveFields — 价格/储备字段组（currencySymbol/usPrice/reserveAccountId）。
 * 源: token-basic-info-section.tsx 299-432（纯代码搬移，逻辑/JSX 不变）。
 */
export interface TokenPricingReserveFieldsProps {
  control: Control<TDEditFormValues>;
  isReadonly: boolean;
  showReserveAccount: boolean;
  symbol?: string;
  currency?: string;
  reserveList?: ReserveAccountOption[];
  currencyList?: CurrencyOption[];
  onCurrencyChange: (value: string) => void;
}

export function TokenPricingReserveFields({
  control,
  isReadonly,
  showReserveAccount,
  symbol,
  currency,
  reserveList,
  currencyList,
  onCurrencyChange,
}: TokenPricingReserveFieldsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      {/* currencySymbol Select（onChange → onCurrencyChange） */}
      <Controller
        control={control}
        name="currencySymbol"
        rules={{ required: true }}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="select-currencySymbol">
              <Required />
              {t('stablecoin_settings_039')}
            </FieldLabel>
            <Select
              value={(field.value as string) ?? ''}
              onValueChange={(v) => {
                field.onChange(v);
                onCurrencyChange(v);
              }}
              disabled={isReadonly}
            >
              <SelectTrigger
                id="select-currencySymbol"
                className="h-10 w-full bg-background"
              >
                <SelectValue placeholder={t('stablecoin_settings_039')} />
              </SelectTrigger>
              <SelectContent>
                {(currencyList ?? []).map((item) => (
                  <SelectItem key={item.key} value={item.value ?? ''}>
                    {item.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      {/* usPrice number input（precision 2，addonBefore/After） */}
      <Controller
        control={control}
        name="usPrice"
        rules={{
          required: true,
          validate: (value) => {
            if (value === undefined || value === null || value === '') {
              return true; // required 兜底
            }
            // 源 antd InputNumber precision={2}：最多 2 位小数
            return /^-?\d+(\.\d{1,2})?$/.test(String(value))
              ? true
              : t('td_form_usprice_invalid');
          },
        }}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="field-usPrice">
              <Required />
              {t('stablecoin_settings_040')}
            </FieldLabel>
            <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {symbol ? (
                <span className="flex shrink-0 whitespace-nowrap items-center border-r bg-muted px-3 text-xs text-muted-foreground">
                  1 {symbol} =
                </span>
              ) : null}
              <input
                id="field-usPrice"
                type="number"
                value={
                  field.value !== undefined && field.value !== null
                    ? String(field.value)
                    : ''
                }
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? undefined : e.target.value,
                  )
                }
                onBlur={field.onBlur}
                name={field.name}
                maxLength={20}
                step={0.01}
                disabled={isReadonly}
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="flex items-center border-l bg-muted px-3 text-sm font-medium">
                {currency || ' '}
              </span>
            </div>
          </Field>
        )}
      />

      {/* reserveAccountId（显隐：showReserveAccount） */}
      {showReserveAccount ? (
        <Controller
          control={control}
          name="reserveAccountId"
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="select-reserveAccountId">
                <Required />
                {t('tokenized_deposit_0174')}
              </FieldLabel>
              <Select
                value={
                  field.value !== undefined && field.value !== null
                    ? String(field.value)
                    : ''
                }
                onValueChange={field.onChange}
                disabled={isReadonly}
              >
                <SelectTrigger
                  id="select-reserveAccountId"
                  className="h-10 w-full bg-background"
                >
                  <SelectValue placeholder={t('tokenized_deposit_0174')} />
                </SelectTrigger>
                <SelectContent>
                  {(reserveList ?? []).map((item) => (
                    <SelectItem
                      key={item.reserveAccountId}
                      value={String(item.reserveAccountId ?? '')}
                    >
                      {item.reserveAccountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      ) : null}
    </>
  );
}
