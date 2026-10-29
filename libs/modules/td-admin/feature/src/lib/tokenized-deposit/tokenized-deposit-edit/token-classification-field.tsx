'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Field, FieldLabel } from '@myorg/shared/ui';

import type {
  TDEditFormValues,
  TokenTypeOption,
} from '@myorg/modules/td-admin/data-access';
import { Required } from './ui/section-card';

/**
 * TokenClassificationField — 代币类型（mintMethod）卡片组单选字段。
 * 源: token-basic-info-section.tsx 113-193（纯代码搬移，逻辑/JSX 不变）。
 */
export interface TokenClassificationFieldProps {
  control: Control<TDEditFormValues>;
  isReadonly: boolean;
  tokenTypeOptions: TokenTypeOption[];
  onTokenTypeChange: (value: number) => void;
}

export function TokenClassificationField({
  control,
  isReadonly,
  tokenTypeOptions,
  onTokenTypeChange,
}: TokenClassificationFieldProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      {/* mintMethod 卡片组选项（onChange → onTokenTypeChange） */}
      <Controller
        control={control}
        name="mintMethod"
        rules={{ required: true }}
        render={({ field, fieldState }) => (
          <Field className="md:col-span-2">
            <div className="flex flex-col gap-1">
              <FieldLabel>
                <Required />
                {t('td_form_token_classification')}
              </FieldLabel>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('td_form_token_classification_desc')}
              </p>
            </div>
            <div
              id="field-mintMethod"
              role="radiogroup"
              aria-label={t('td_form_token_classification')}
              tabIndex={-1}
              className="grid gap-3 sm:grid-cols-3"
            >
              {tokenTypeOptions.map((item) => {
                const value = Number(item.tokenTypeId);
                const selected = Number(field.value) === value;
                const disabled = isReadonly || item.status === 0;
                const description =
                  value === 1
                    ? t('td_form_token_type_stablecoin_desc')
                    : value === 5
                      ? t('td_form_token_type_deposit_desc')
                      : value === 20
                        ? t('td_form_token_type_mmf_desc')
                        : t('td_form_token_type_generic_desc');

                return (
                  <button
                    key={item.tokenTypeId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => {
                      field.onChange(value);
                      onTokenTypeChange(value);
                    }}
                    className={`rounded-md border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/15'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {item.tokenTypeName}
                      </span>
                      <span
                        className={`size-4 rounded-full border-4 ${
                          selected
                            ? 'border-primary bg-card'
                            : 'border-input bg-card'
                        }`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldState.error ? (
              <p className="text-xs text-destructive">
                {t('td_form_token_classification_required')}
              </p>
            ) : null}
          </Field>
        )}
      />
    </>
  );
}
