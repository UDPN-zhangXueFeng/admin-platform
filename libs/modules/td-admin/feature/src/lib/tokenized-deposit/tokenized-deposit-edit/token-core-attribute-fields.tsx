'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Field, FieldLabel, Input } from '@myorg/shared/ui';

import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access';
import { Required } from './ui/section-card';

/**
 * TokenCoreAttributeFields — 核心属性字段组（heading + name/symbol/decimals）。
 * 源: token-basic-info-section.tsx 195-297（纯代码搬移，逻辑/JSX 不变）。
 */
export interface TokenCoreAttributeFieldsProps {
  control: Control<TDEditFormValues>;
  isReadonly: boolean;
}

export function TokenCoreAttributeFields({
  control,
  isReadonly,
}: TokenCoreAttributeFieldsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      <div className="border-t pt-6 md:col-span-2">
        <h3 className="text-sm font-semibold">
          {t('td_form_core_attributes')}
        </h3>
      </div>

      {/* name Input（maxLength 32） */}
      <Controller
        control={control}
        name="name"
        rules={{ required: true }}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="field-name">
              <Required />
              {t('tokenized_deposit_0005')}
            </FieldLabel>
            <Input
              id="field-name"
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              maxLength={32}
              className="h-10"
            />
          </Field>
        )}
      />

      {/* symbol Input（maxLength 5） */}
      <Controller
        control={control}
        name="symbol"
        rules={{ required: true }}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="field-symbol">
              <Required />
              {t('tokenized_deposit_0006')}
            </FieldLabel>
            <Input
              id="field-symbol"
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              maxLength={5}
              className="h-10"
            />
          </Field>
        )}
      />

      {/* decimals number input（max 8 min 0） */}
      <Controller
        control={control}
        name="decimals"
        rules={{
          required: true,
          validate: (value) => {
            if (value === undefined || value === null || String(value) === '') {
              return true; // required 兜底
            }
            const parsed = Number(value);
            return Number.isInteger(parsed) && parsed >= 0 && parsed <= 8
              ? true
              : t('td_form_decimals_invalid');
          },
        }}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="field-decimals">
              <Required />
              {t('stablecoin_settings_009')}
            </FieldLabel>
            <Input
              id="field-decimals"
              type="number"
              value={
                field.value !== undefined && field.value !== null
                  ? String(field.value)
                  : ''
              }
              onChange={(e) =>
                field.onChange(
                  e.target.value === ''
                    ? undefined
                    : Number(e.target.value),
                )
              }
              onBlur={field.onBlur}
              name={field.name}
              min={0}
              max={8}
              step={1}
              disabled={isReadonly}
              placeholder={t('tokenized_deposit_0110')}
              className="h-10"
            />
          </Field>
        )}
      />
    </>
  );
}
