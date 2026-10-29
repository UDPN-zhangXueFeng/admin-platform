'use client';

import { useTranslations } from 'next-intl';
import React, { type ChangeEvent, type ReactNode } from 'react';
import {
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import { FINANCIAL_BOOK_NAME_MAX_LENGTH } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';

import type { CoaSetupErrors, CoaSetupInfo, CoaSetupOption } from './coa-setup-types';
import { FALLBACK_SELECT_VALUE, formatTimeValue, parseTimeValue } from './coa-time-utils';

/**
 * CoaSetupCardFields — COA 卡片 4 字段表单组（原 handleXxxChange 回调 +
 * renderField 容器 + 字段 grid）。
 * 源: coa-setup-card.tsx 261-286、370-390、412-513（纯代码搬移，逻辑/JSX 不变）。
 */
export interface CoaSetupCardFieldsProps {
  data: CoaSetupInfo;
  errors?: CoaSetupErrors;
  isFieldDisabled: boolean;
  isSetupRequired: boolean;
  resolvedAccountTemplateOptions: CoaSetupOption[];
  resolvedTimezoneOptions: CoaSetupOption[];
  /** patch 合并回调（父组件 updateData）。 */
  updateData: (patch: Partial<CoaSetupInfo>) => void;
}

export function CoaSetupCardFields({
  data,
  errors,
  isFieldDisabled,
  isSetupRequired,
  resolvedAccountTemplateOptions,
  resolvedTimezoneOptions,
  updateData,
}: CoaSetupCardFieldsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // ── Select 选中回调：同时写 code + name/label ──
  const handleAccountTemplateChange = (value: string) => {
    // fallback 占位符被选中时不更新（理论上 fallback 态 disabled，不会触发）
    if (value === FALLBACK_SELECT_VALUE) return;
    const selected = resolvedAccountTemplateOptions.find(
      (o) => o.value === value,
    );
    updateData({
      accountTemplateCode: value,
      accountTemplateName: selected?.label ?? value,
    });
  };

  const handleTimezoneChange = (value: string) => {
    if (value === FALLBACK_SELECT_VALUE) return;
    const selected = resolvedTimezoneOptions.find((o) => o.value === value);
    updateData({
      timeZone: value,
      timeZoneLabel: selected?.label ?? value,
    });
  };

  // ── EOD time input onChange ──
  const handleEodCutOffTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateData({ eodCutOffTime: formatTimeValue(event.target.value) });
  };

  // ── 渲染单字段容器（shared/ui Field 系统）──
  const renderField = (
    labelKey: string,
    error: string | undefined,
    children: ReactNode,
    footer?: ReactNode,
  ) => (
    <Field>
      <FieldLabel>
        {isSetupRequired ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
        {t(labelKey)}
      </FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
      {footer}
    </Field>
  );

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
      {/* 1) Financial Book Name */}
      {renderField(
        'tokenized_deposit_coa_financial_book_name',
        errors?.financialBookName,
        <Input
          value={data.financialBookName ?? ''}
          disabled={isFieldDisabled}
          maxLength={FINANCIAL_BOOK_NAME_MAX_LENGTH}
          placeholder={
            isSetupRequired
              ? t('tokenized_deposit_coa_financial_book_placeholder')
              : undefined
          }
          onChange={(event) =>
            updateData({ financialBookName: event.target.value })
          }
          className={
            errors?.financialBookName
              ? 'border-destructive focus-visible:ring-destructive'
              : undefined
          }
        />,
      )}

      {/* 2) Account Template */}
      {renderField(
        'tokenized_deposit_coa_account_template',
        errors?.accountTemplateCode,
        <Select
          value={data.accountTemplateCode ?? ''}
          disabled={isFieldDisabled}
          onValueChange={handleAccountTemplateChange}
        >
          <SelectTrigger
            className={
              errors?.accountTemplateCode ? 'border-destructive' : ''
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resolvedAccountTemplateOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.value === FALLBACK_SELECT_VALUE}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      )}

      {/* 3) EOD Cut-off Time */}
      {renderField(
        'tokenized_deposit_coa_eod_cutoff',
        errors?.eodCutOffTime,
        <input
          type="time"
          step={1}
          value={parseTimeValue(data.eodCutOffTime)}
          disabled={isFieldDisabled}
          onChange={handleEodCutOffTimeChange}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            errors?.eodCutOffTime ? 'border-destructive' : ''
          }`}
        />,
        <div className="mt-2 text-sm text-muted-foreground">
          {t('tokenized_deposit_coa_rollover_notice')}
        </div>,
      )}

      {/* 4) Time Zone */}
      {renderField(
        'tokenized_deposit_coa_time_zone',
        errors?.timeZone,
        <Select
          value={data.timeZone ?? ''}
          disabled={isFieldDisabled}
          onValueChange={handleTimezoneChange}
        >
          <SelectTrigger
            className={errors?.timeZone ? 'border-destructive' : ''}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resolvedTimezoneOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.value === FALLBACK_SELECT_VALUE}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      )}
    </div>
  );
}
