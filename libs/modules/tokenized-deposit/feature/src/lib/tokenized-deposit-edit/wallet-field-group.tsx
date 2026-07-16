'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Textarea,
} from '@myorg/shared/ui';

import type { TDEditFormValues } from '@myorg/modules/tokenized-deposit/data-access';
import { Required } from './ui/section-card';

/**
 * WalletFieldGroup — 单组管理员钱包字段（地址 + 可选 keystore / password）。
 *
 * 迁移自 td-manage `edit/WalletFieldGroup.tsx`。纯字段渲染（地址 / keystore /
 * password）；「Generate Wallet」入口由父级 AdminWalletSection 的卡片 footer 承载。
 *
 * ## 字段（3 类，按 roleName 取不同 fieldName 后缀）
 *
 * 地址 required + 校验非空；keyStore/password 仅 `showKeystoreAndPassword` 时渲染
 * （rigsec/fireblocks 路径隐藏）。
 *
 * ## 与源差异
 *
 * - antd Form + FormRule validator → Controller rules.required + 自定义 validate。
 * - `t('PUB_Pleased').replace('****', label)` 占位符清理改为 next-intl ICU（调用方传已解析文案）。
 * - Input.Password → shared/ui Input type=password；Input.TextArea → shared/ui Textarea。
 */
export interface WalletFieldGroupProps {
  /** react-hook-form control（注册表单字段）。 */
  control: Control<TDEditFormValues>;
  /** 字段名映射（walletAddress / keyStore / password）。 */
  fieldNames: {
    walletAddress: string;
    keyStore?: string;
    password?: string;
  };
  /** i18n label key 映射（与 fieldNames 对应）。 */
  labelKeys: {
    walletAddress: string;
    keyStore?: string;
    password?: string;
  };
  /** 地址输入 disabled（applyStatus===35 或 rigsec/fireblocks 路径）。 */
  disabled: boolean;
  /** keyStore/password 字段 disabled（applyStatus===35 编辑只读）。 */
  secureFieldDisabled: boolean;
  /** 是否渲染 keyStore/password（keystore 路径 true / rigsec false）。 */
  showKeystoreAndPassword: boolean;
}

/** 钱包角色类型（1=Contract Owner / 2=Gas Payment / 3=Management）。 */
export type WalletRoleType = 1 | 2 | 3;

export function WalletFieldGroup({
  control,
  fieldNames,
  labelKeys,
  disabled,
  secureFieldDisabled,
  showKeystoreAndPassword,
}: WalletFieldGroupProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const walletAddressLabel = t(labelKeys.walletAddress);
  const keyStoreLabel = t(labelKeys.keyStore ?? 'tokenized_deposit_0079');
  const passwordLabel = t(labelKeys.password ?? 'tokenized_deposit_0080');

  return (
    <FieldGroup>
      {/* ── 钱包地址（required）── */}
      <Controller
        control={control}
        name={fieldNames.walletAddress as keyof TDEditFormValues}
        rules={{
          required: true,
          validate: (value) => {
            if (!value) return false;
            return true;
          },
        }}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor={`field-${fieldNames.walletAddress}`}>
              <Required />
              {walletAddressLabel}
            </FieldLabel>
            <Input
              id={`field-${fieldNames.walletAddress}`}
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              disabled={disabled}
              aria-invalid={!!fieldState.error}
              className="h-10 font-mono text-xs"
            />
            {fieldState.error ? (
              <FieldError>{t('PUB_Pleased', { field: walletAddressLabel })}</FieldError>
            ) : null}
          </Field>
        )}
      />

      {/* ── keyStore（仅 keystore 路径渲染）── */}
      {showKeystoreAndPassword && fieldNames.keyStore ? (
        <Controller
          control={control}
          name={fieldNames.keyStore as keyof TDEditFormValues}
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`field-${fieldNames.keyStore}`}>
                <Required />
                {keyStoreLabel}
              </FieldLabel>
              <Textarea
                id={`field-${fieldNames.keyStore}`}
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                disabled={secureFieldDisabled}
                aria-invalid={!!fieldState.error}
                className="min-h-20 resize-none font-mono text-xs"
              />
              {fieldState.error ? (
                <FieldError>{t('PUB_Pleased', { field: keyStoreLabel })}</FieldError>
              ) : null}
            </Field>
          )}
        />
      ) : null}

      {/* ── password（仅 keystore 路径渲染）── */}
      {showKeystoreAndPassword && fieldNames.password ? (
        <Controller
          control={control}
          name={fieldNames.password as keyof TDEditFormValues}
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`field-${fieldNames.password}`}>
                <Required />
                {passwordLabel}
              </FieldLabel>
              <Input
                id={`field-${fieldNames.password}`}
                type="password"
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                placeholder=""
                autoComplete="new-password"
                disabled={secureFieldDisabled}
                aria-invalid={!!fieldState.error}
                className="h-10"
              />
              {fieldState.error ? (
                <FieldError>{t('PUB_Pleased', { field: passwordLabel })}</FieldError>
              ) : null}
            </Field>
          )}
        />
      ) : null}
    </FieldGroup>
  );
}
