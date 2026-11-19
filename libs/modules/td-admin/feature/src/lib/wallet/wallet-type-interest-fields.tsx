'use client';

import { Controller, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@myorg/shared/ui';
import type { InterestPolicy, WalletTypeDetail } from '@myorg/modules/td-admin/data-access';
import { AddressField, ReadOnlyField, type WalletTypeFormValues } from './wallet-type-form-fields';

export function WalletTypeInterestFields({ control, errors, policies, policy, detail, isEdit, onSelect }: {
  control: Control<WalletTypeFormValues>;
  errors: FieldErrors<WalletTypeFormValues>;
  policies: InterestPolicy[];
  policy?: InterestPolicy;
  detail?: WalletTypeDetail;
  isEdit: boolean;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations('modules.wallet');
  const label = (key: string) => t(`walletType.form.label.${key}`);
  const required = (field: string) => t('walletType.form.validation.required', { field });
  const tiers = useWatch({ control, name: 'saveDetails' });
  const isTiered = policy?.calculateType === 2;
  const isNegative = (policy?.annualInterestRates ?? []).some(({ interestRate }) => String(interestRate).startsWith('-'));
  const policyLabel = label('arrangedInterestPolicy');
  const addressLabel = t('walletType.detail.walletAddress') + t(isNegative
    ? 'walletType.detail.forReceivingDepositInterest'
    : 'walletType.detail.forDepositInterestPayments');

  return (
    <Card className="space-y-4 p-6">
      <h4>{t('walletType.form.section.interest')}</h4>
      <p className="text-sm text-muted-foreground">{t('walletType.form.section.interestDesc')}</p>
      <Controller control={control} name="arrangedInterestPolicyId" rules={{ required: required(policyLabel) }}
        render={({ field, fieldState }) => (
          <div className="w-[45%] min-w-[200px] space-y-1.5">
            <Label htmlFor="wt-arranged-policy">{policyLabel}</Label>
            <Select value={field.value == null ? '' : String(field.value)} onValueChange={(value) => onSelect(Number(value))}>
              <SelectTrigger id="wt-arranged-policy" aria-invalid={!!fieldState.error}><SelectValue placeholder={policyLabel} /></SelectTrigger>
              <SelectContent>
                {policies.map(({ interestRuleId, interestPolicyName }) => interestRuleId == null ? null : (
                  <SelectItem key={interestRuleId} value={String(interestRuleId)}>{interestPolicyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
          </div>
        )}
      />
      {isTiered ? (
        <table className="w-full text-left text-sm">
          <thead><tr>{['tierMin', 'tierMax', 'tierRate'].map((key) => <th key={key}>{label(key)}</th>)}</tr></thead>
          <tbody>{tiers?.map((tier, index) => (
            <tr key={index}><td>{tier.minValue}</td><td>{tier.maxValue}</td><td>{tier.interestRate}%</td></tr>
          ))}</tbody>
        </table>
      ) : <ReadOnlyField control={control} name="arrangedInterestRate" label={label('arrangedInterestRate')} />}
      <ReadOnlyField control={control} name="arrangedInterestEffectiveDate" label={label('arrangedInterestEffectiveDate')} />
      <AddressField control={control} name="depositInterestWalletAddress" label={addressLabel}
        error={errors.depositInterestWalletAddress} t={t} locked={isEdit && Boolean(detail?.depositInterestWalletAddress)} />
      {!isNegative && (
        <>
          {!isEdit && (['depositInterestKeyStore', 'depositInterestKeyStorePassword'] as const).map((name) => (
            <Controller key={name} control={control} name={name} shouldUnregister rules={{ required: required(label(name)) }}
              render={({ field, fieldState }) => (
                <div className="w-[45%] min-w-[200px] space-y-1.5">
                  <Label htmlFor={name}>{label(name)}</Label>
                  {name === 'depositInterestKeyStore' ? <Textarea {...field} id={name} value={field.value ?? ''} /> : (
                    <Input {...field} id={name} type="password" autoComplete="new-password" value={field.value ?? ''} />
                  )}
                  {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
                </div>
              )}
            />
          ))}
          <AddressField control={control} name="accountClosureInterestWalletAddress" label={label('accountClosureInterestWalletAddress')}
            error={errors.accountClosureInterestWalletAddress} t={t} locked={isEdit && Boolean(detail?.accountClosureInterestWalletAddress)} />
        </>
      )}
    </Card>
  );
}
