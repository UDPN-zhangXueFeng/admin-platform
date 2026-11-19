'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import type { MmfFormValues } from './wallet-type-form-fields';

export function WalletTypeMmfFundFields({ control, errors, isEdit, symbol, today }: {
  control: Control<MmfFormValues>;
  errors: FieldErrors<MmfFormValues>;
  isEdit: boolean;
  symbol?: string;
  today: string;
}) {
  const t = useTranslations('modules.wallet');
  const fundTypeOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  const riskLevelOptions = [1, 2, 3, 4];
  return (
      <Card className="p-6">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('walletType.form.section.mmfBasic')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('walletType.form.section.mmfBasicDesc')}
        </p>
        <div className="flex flex-wrap justify-between gap-4">
          <Controller
            control={control}
            name="tokenName"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.tokenName')}
                </Label>
                <Input value={(field.value as string) ?? ''} disabled />
              </div>
            )}
          />
          <Controller
            control={control}
            name="accountType"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.accountType')}
                </Label>
                <Input value={(field.value as string) ?? ''} disabled />
              </div>
            )}
          />
          <Controller
            control={control}
            name="name"
            rules={{
              required: t('walletType.form.validation.required', {
                field: t('walletType.form.label.fundName'),
              }),
              pattern: {
                value: /^[a-zA-Z0-9 \-/]+$/,
                message: t('walletType.form.validation.namePattern'),
              },
            }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundName')}
                </Label>
                <Input
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  maxLength={50}
                  placeholder={t('walletType.form.placeholder.walletTypeName')}
                  aria-invalid={!!errors.name}
                />
                {errors.name ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.name.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="walletTypeCode"
            rules={{
              required: t('walletType.form.validation.required', {
                field: t('walletType.form.label.walletTypeCode'),
              }),
              pattern: {
                value: /^[a-zA-Z0-9._-]+$/,
                message: t('walletType.form.validation.codePattern'),
              },
            }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.walletTypeCode')}
                </Label>
                <Input
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  maxLength={20}
                  disabled={isEdit}
                  placeholder={t('walletType.form.placeholder.walletTypeCode')}
                  aria-invalid={!!errors.walletTypeCode}
                />
                {errors.walletTypeCode ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.walletTypeCode.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="fundType"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundType')}
                </Label>
                <Select
                  value={
                    field.value != null ? String(field.value) : undefined
                  }
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger aria-invalid={!!errors.fundType}>
                    <SelectValue placeholder={t('walletType.form.label.fundType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fundTypeOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t(`walletType.mmfFundType.${n}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fundType ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('walletType.form.validation.required', {
                      field: t('walletType.form.label.fundType'),
                    })}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="riskLevel"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.riskLevel')}
                </Label>
                <Select
                  value={
                    field.value != null ? String(field.value) : undefined
                  }
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger aria-invalid={!!errors.riskLevel}>
                    <SelectValue placeholder={t('walletType.form.label.riskLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevelOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t(`walletType.mmfRiskLevel.${n}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.riskLevel ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('walletType.form.validation.required', {
                      field: t('walletType.form.label.riskLevel'),
                    })}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="fundAssetValue"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundAssetValue')}
                </Label>
                <div className="flex items-stretch">
                  <Input
                    type="number"
                    value={field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="rounded-r-none"
                    disabled
                  />
                  {symbol ? (
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                      {symbol}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          />
          <div className="w-[45%] min-w-[200px]">
            <FormDatePicker<MmfFormValues>
              name="fundInceptionTime"
              control={control}
              label={t('walletType.form.label.fundInceptionTime')}
              required
              disabled={isEdit}
              max={today}
              error={errors.fundInceptionTime?.message}
            />
          </div>
        </div>
      </Card>
  );
}
