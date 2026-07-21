'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { HelpCircle, Network } from 'lucide-react';
import {
  Badge,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import type {
  BlockchainOption,
  CurrencyOption,
  ReserveAccountOption,
  SmartContractOption,
  TDEditDetail,
  TDEditFormValues,
  TokenTypeOption,
} from '@myorg/modules/tokenized-deposit/data-access';
import { Required, SectionHeading } from './ui/section-card';

/** Whitelist Mode 选项（partial/noWhitelist disabled，源同）。 */
const WHITELIST_MODE_OPTIONS = [
  { value: 'full', label: 'Full Whitelist' },
  { value: 'partial', label: 'Partial Whitelist', disabled: true },
  { value: 'noWhitelist', label: 'No Whitelist', disabled: true },
];

/** 阈值类型选项。 */
const THRESHOLD_TYPE_OPTIONS = [
  { value: 'volume', label: 'Volume' },
  { value: 'txnCount', label: 'TXN Count' },
];

/** 阈值频率选项。 */
const THRESHOLD_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * TokenBasicInfoSection — 代币基本信息区（edit 最大组件）。
 *
 * 迁移自 td-manage `edit/TokenBasicInfoSection.tsx`（406 行）。重设计后拆为两张卡：
 * 「Token details」（mintMethod/name/symbol/decimals/currency/usPrice/reserve）+
 * 「Network & contract」（blockchain/contract/meta/whitelist/threshold）。字段与逻辑不变。
 *
 * ## 只读
 *
 * `isReadonly = !!code && applyStatus===35`（贯穿 Select/Input/Radio disabled）。
 *
 * ## 联动回调（来自 td-13 edit 页壳 / td-11 hooks）
 *
 * - onTokenTypeChange(value) —— mintMethod Select onChange（→ setTokenTypeId）。
 * - onBlockchainChange(value) —— blockchain Select onChange（→ useBlockchainEffect）。
 * - onCurrencyChange(value) —— currency Select onChange（→ getReserveList）。
 */
export interface TokenBasicInfoSectionProps {
  control: Control<TDEditFormValues>;
  hasCode: boolean;
  detailInfo: TDEditDetail;
  flag: boolean;
  chainType: string;
  mintMethod?: number;
  symbol?: string;
  currency?: string;
  thresholdType?: string;
  reserveList?: ReserveAccountOption[];
  blockchainList?: BlockchainOption[];
  currencyList?: CurrencyOption[];
  smartContractNameList?: SmartContractOption[];
  /** Smart Contract 查询失败标志（inline 错误反馈，文档 14.5）。 */
  smartContractError?: boolean;
  /** Reserve 查询失败标志（inline 错误反馈，文档 14.5）。 */
  reserveError?: boolean;
  tokenTypeOptions: TokenTypeOption[];
  onBlockchainChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onTokenTypeChange: (value: number) => void;
}

export function TokenBasicInfoSection({
  control,
  hasCode,
  detailInfo,
  flag,
  chainType,
  mintMethod,
  symbol,
  currency,
  thresholdType,
  reserveList,
  blockchainList,
  currencyList,
  smartContractNameList,
  tokenTypeOptions,
  onBlockchainChange,
  onCurrencyChange,
  onTokenTypeChange,
}: TokenBasicInfoSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const isReadonly = hasCode && detailInfo.applyStatus === 35;
  const showReserveAccount = !flag && mintMethod === 1;

  return (
    <div className="flex flex-col gap-9">
      <section>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
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
            rules={{ required: true }}
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
            rules={{ required: true }}
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
        </FieldGroup>
      </section>

      <section className="border-t border-border pt-7">
        <SectionHeading
          icon={Network}
          title={t('td_section_network')}
          description={t('td_section_network_desc')}
          embedded
        />
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          {/* blockchainId Select（逐项 disabled status!==1，onChange → onBlockchainChange） */}
          <Controller
            control={control}
            name="blockchainId"
            rules={{ required: true }}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="select-blockchainId">
                  <Required />
                  {t('tokenized_deposit_0007')}
                </FieldLabel>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v);
                    onBlockchainChange(v);
                  }}
                  disabled={isReadonly}
                >
                  <SelectTrigger
                    id="select-blockchainId"
                    className="h-10 w-full bg-background"
                  >
                    <SelectValue placeholder={t('tokenized_deposit_0007')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(blockchainList ?? []).map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.key}
                        disabled={item.status !== 1}
                      >
                        {item.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          {/* smartContractPackageId Select */}
          <Controller
            control={control}
            name="smartContractPackageId"
            rules={{ required: true }}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="select-smartContractPackageId">
                  <Required />
                  {t('tokenized_deposit_0016')}
                </FieldLabel>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={field.onChange}
                  disabled={isReadonly}
                >
                  <SelectTrigger
                    id="select-smartContractPackageId"
                    className="h-10 w-full bg-background"
                  >
                    <SelectValue placeholder={t('tokenized_deposit_0016')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(smartContractNameList ?? []).map((item) => (
                      <SelectItem
                        key={String(item.key)}
                        value={String(item.key ?? '')}
                      >
                        {item.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          {/* whitelistMode Select（partial/noWhitelist disabled） */}
          <Controller
            control={control}
            name="whitelistMode"
            rules={{ required: true }}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="select-whitelistMode">
                  {t('tokenized_deposit_whitelist_mode')}
                </FieldLabel>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={field.onChange}
                  disabled={isReadonly}
                >
                  <SelectTrigger
                    id="select-whitelistMode"
                    className="h-10 w-full bg-background"
                  >
                    <SelectValue
                      placeholder={t(
                        'tokenized_deposit_whitelist_mode_placeholder',
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {WHITELIST_MODE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.disabled}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          {/* metaType RadioGroup（5=Yes/1=No，disabled isReadonly||tron） */}
          <Controller
            control={control}
            name="metaType"
            rules={{
              required: true,
              validate: (value) => value !== undefined && value !== null,
            }}
            render={({ field }) => (
              <Field>
                <FieldLabel>
                  <Required />
                  {t('tokenized_deposit_0090')}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-4 cursor-help text-primary" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        {t('tokenized_deposit_0136')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FieldLabel>
                <RadioGroup
                  id="field-metaType"
                  value={field.value !== undefined ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(Number(v))}
                  disabled={isReadonly || chainType === 'tron'}
                  className="flex gap-6"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="5" />
                    {t('PUB_Yes')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="1" />
                    {t('PUB_No')}
                  </label>
                </RadioGroup>
              </Field>
            )}
          />

          {/* threshold 区（仅 mintMethod===1 显） */}
          {mintMethod === 1 ? (
            <Field className="border-t pt-7 md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <FieldLabel>
                    {t('tokenized_deposit_threshold_title')}
                  </FieldLabel>
                  <p className="text-sm text-muted-foreground">
                    {t('td_form_threshold_desc')}
                  </p>
                </div>
                <Badge variant="secondary">{t('td_form_optional')}</Badge>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {/* thresholdType Select */}
                <Controller
                  control={control}
                  name="thresholdType"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>{t('td_form_threshold_metric')}</FieldLabel>
                      <Select
                        value={(field.value as string) ?? ''}
                        onValueChange={field.onChange}
                        disabled={isReadonly}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder={t(
                              'tokenized_deposit_threshold_type_placeholder',
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {THRESHOLD_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                {/* thresholdFrequency Select */}
                <Controller
                  control={control}
                  name="thresholdFrequency"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>{t('td_form_threshold_period')}</FieldLabel>
                      <Select
                        value={(field.value as string) ?? ''}
                        onValueChange={field.onChange}
                        disabled={isReadonly}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder={t(
                              'tokenized_deposit_threshold_frequency_placeholder',
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {THRESHOLD_FREQUENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                {/* thresholdValue number input */}
                <Controller
                  control={control}
                  name="thresholdValue"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>{t('td_form_threshold_value')}</FieldLabel>
                      <div className="flex h-10 overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <Input
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
                                : e.target.value,
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          min={0}
                          step={0.01}
                          placeholder="0"
                          disabled={isReadonly}
                          className="min-w-0 flex-1 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="flex min-w-16 items-center justify-center border-l border-input bg-muted px-3 text-sm text-muted-foreground">
                          {thresholdType === 'volume' ? symbol || '--' : '--'}
                        </span>
                      </div>
                    </Field>
                  )}
                />
              </div>
            </Field>
          ) : null}
        </FieldGroup>
      </section>
    </div>
  );
}
