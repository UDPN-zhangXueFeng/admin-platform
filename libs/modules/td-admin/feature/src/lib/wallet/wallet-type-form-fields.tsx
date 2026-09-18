'use client';

import * as React from 'react';
import {
  Controller,
  type Control,
  type FieldError,
  type Path,
} from 'react-hook-form';
import { Input, Label } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';

/**
 * 钱包类型表单字段共享子组件（常规 + MMF 复用）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/{edit,mff/mff-add}.tsx` 的 antd
 * `Form.Item` 重复结构。这里抽出 4 类字段：金额（InputNumber+symbol 后缀）、
 * 地址（Input，编辑态按已有值锁定）、纯文本标签字段、数字 Input。
 *
 * 设计：字段组件接收 `control` + `error`（主组件订阅 formState.errors 后传入，
 * 避免 each Controller 各自订阅造成重渲染）。子组件不进 barrel。
 */

/** 常规表单值类型（字段众多，按 accountType × interest 分支渲染，未渲染字段为可选）。 */
export interface WalletTypeFormValues {
  tokenName?: string;
  accountType?: number;
  interestFeatureEnablement?: boolean;
  name?: string;
  singleTradingLimit?: number | string;
  dailyTradingLimit?: number | string;
  balanceLimit?: number | string;
  minimumBalance?: number | string;
  dailyRedeemLimit?: number | string;
  maintenanceFee?: number | string;
  maintenanceFeeCycle?: number;
  monthlyMinimumBalanceFee?: number | string;
  accountFeesWalletAddress?: string;
  arrangedInterestPolicyId?: number;
  unarrangedInterestPolicyId?: number;
  arrangedInterestRate?: string;
  unarrangedInterestRate?: string;
  arrangedInterestEffectiveDate?: string;
  unarrangedInterestEffectiveDate?: string;
  saveDetails?: Array<{
    minValue?: string | number;
    maxValue?: string | number;
    interestRate?: string | number;
  }>;
  depositInterestWalletAddress?: string;
  depositInterestKeyStore?: string;
  depositInterestKeyStorePassword?: string;
  accountClosureInterestWalletAddress?: string;
  arrangedOverdraftAmount?: number | string;
  overdraftBufferAmount?: number | string;
  overdraftBufferPeriod?: number;
  unarrangedOverdraftAmount?: number | string;
  unarrangedOverdraftFee?: number | string;
  unarrangedOverdraftFeeMax?: number | string;
  receivingOverdraftFeeWalletAddress?: string;
  receivingOverdraftInterestWalletAddress?: string;
  [k: string]: unknown;
}

/** MMF 表单值类型。 */
export interface MmfFormValues {
  tokenName?: string;
  accountType?: string;
  name?: string;
  walletTypeCode?: string;
  fundType?: number;
  riskLevel?: number;
  fundAssetValue?: number | string;
  fundInceptionTime?: string;
  depositInterestWalletAddress?: string;
  depositInterestKeyStore?: string;
  depositInterestKeyStorePassword?: string;
  dailyStatisticalTime?: string;
  [k: string]: unknown;
}

type Translate = ReturnType<typeof useTranslations>;

/** 源码金额校验：`/^[0-9]+(.[0-9]{1,2})?$/`（整数或最多 2 位小数）。 */
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]{1,2})?$/;

/** 金额校验工厂（返回 RHF rules.validate）。空 → 必填错误；不匹配 → 格式错误。 */
function amountRules(t: Translate, label: string) {
  return {
    required: t('walletType.form.validation.required', { field: label }),
    validate: (value: unknown) => {
      const v = value === undefined || value === null ? '' : String(value);
      if (!v) return t('walletType.form.validation.required', { field: label });
      return (
        AMOUNT_PATTERN.test(v) || t('walletType.form.validation.amount')
      );
    },
  };
}

/**
 * 金额字段（InputNumber → type=number Input + symbol 后缀）。
 *
 * 迁移自源 `Form.Item + InputNumber addonAfter={symbol} max={99999999999}`。
 * 提交归一（≥99999999999 → -1）在主组件 onFinish 处理，此处仅承载值。
 */
export function AmountField({
  control,
  name,
  label,
  symbol,
  error,
  t,
}: {
  control: Control<WalletTypeFormValues>;
  name: Path<WalletTypeFormValues>;
  label: string;
  symbol?: string;
  error: FieldError | undefined;
  t: Translate;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      rules={amountRules(t, label)}
      render={({ field }) => (
        <div className="w-[45%] min-w-[200px]">
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <div className="flex items-stretch">
            <Input
              type="number"
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(v === '' ? undefined : Number(v));
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              max={99999999999}
              className="rounded-r-none"
              aria-invalid={!!error}
            />
            {symbol ? (
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                {symbol}
              </span>
            ) : null}
          </div>
          {error ? (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {String(error.message ?? '')}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}

/**
 * 地址字段（Input，编辑态且详情已有值时锁定 + 锁定提示）。
 *
 * 迁移自源 `wallet_type_086`（地址创建后不可改）。
 */
export function AddressField({
  control,
  name,
  label,
  error,
  t,
  locked,
}: {
  control: Control<WalletTypeFormValues>;
  name: Path<WalletTypeFormValues>;
  label: string;
  error: FieldError | undefined;
  t: Translate;
  /** 编辑态且详情已存在该地址 → 锁定输入并展示提示。 */
  locked?: boolean;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ required: t('walletType.form.validation.required', { field: label }) }}
      render={({ field }) => (
        <div className="w-[45%] min-w-[200px]">
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <Input
            value={(field.value as string) ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            disabled={locked}
            aria-invalid={!!error}
          />
          {locked ? (
            <p className="mt-1 text-sm text-primary">
              {t('walletType.form.addressLocked')}
            </p>
          ) : null}
          {!locked && error ? (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {String(error.message ?? '')}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}

/** 纯展示文本字段（disabled Input，如 tokenName / 只读利率 / 生效日期）。 */
export function ReadOnlyField({
  control,
  name,
  label,
  suffix,
}: {
  control: Control<WalletTypeFormValues>;
  name: Path<WalletTypeFormValues>;
  label: string;
  suffix?: string;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="w-[45%] min-w-[200px]">
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <div className="flex items-stretch">
            <Input
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              disabled
            />
            {suffix ? (
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                {suffix}
              </span>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
