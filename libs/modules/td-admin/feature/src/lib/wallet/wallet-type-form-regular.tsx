'use client';

import { useEffect, useState, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import {
  useAccountTypesQuery, useAddWalletTypeMutation, useInterestPolicyQuery, useUpdateWalletTypeMutation,
  useWalletTypeDetailQuery, type InterestPolicy, type WalletTypeDetail, type WalletTypeSavePayload,
} from '@myorg/modules/td-admin/data-access';
import { getEncryptionData, UNLIMITED_THRESHOLD } from '.';
import { AddressField, AmountField, ReadOnlyField, type WalletTypeFormValues } from './wallet-type-form-fields';
import { WalletTypeInterestFields } from './wallet-type-interest-fields';
import { WalletTypeSubmitDialog } from './wallet-type-submit-dialog';

const LIMIT_FIELDS = ['singleTradingLimit', 'dailyTradingLimit', 'balanceLimit', 'minimumBalance', 'dailyRedeemLimit'] as const;
const EMPTY_POLICIES: InterestPolicy[] = [];

function limitForEdit(value: number | string | undefined) {
  return String(value) === '-1' ? UNLIMITED_THRESHOLD : value;
}

function limitForSubmit(value: number | string | undefined) {
  return /^0*99999999999(?:\.0{1,2})?$/.test(String(value)) ? -1 : Number(value);
}

function policyDate(raw: string | number | undefined): string {
  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp) || !timestamp) return '';
  const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function defaults(tokenName: string | undefined, detail?: WalletTypeDetail): WalletTypeFormValues {
  if (!detail) return { tokenName, maintenanceFeeCycle: 1 };
  return {
    tokenName, name: detail.name, accountType: detail.accountType,
    singleTradingLimit: limitForEdit(detail.singleTradingLimit), dailyTradingLimit: limitForEdit(detail.dailyTradingLimit),
    balanceLimit: limitForEdit(detail.balanceLimit), minimumBalance: limitForEdit(detail.minimumBalance),
    dailyRedeemLimit: limitForEdit(detail.dailyRedeemLimit),
    interestFeatureEnablement: detail.accountType !== 1 && detail.interestFeatureEnablement === 2,
    maintenanceFee: String(detail.maintenanceFee) === '0' ? '' : detail.maintenanceFee,
    maintenanceFeeCycle: detail.feeCycle || 1,
    monthlyMinimumBalanceFee: String(detail.minimumBalanceFee) === '0' ? '' : detail.minimumBalanceFee,
    accountFeesWalletAddress: detail.accountFeesWalletAddress,
    arrangedInterestPolicyId: detail.arrangedInterestPolicyId,
    depositInterestWalletAddress: detail.depositInterestWalletAddress,
    accountClosureInterestWalletAddress: detail.accountClosureInterestWalletAddress,
  };
}

export function WalletTypeRegularForm({ ruleId, tdId, tokenName, symbol, issueType }: {
  ruleId?: number;
  tdId: number;
  tokenName?: string;
  symbol?: string;
  issueType?: number;
}) {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const isEdit = ruleId != null;
  const isTd = issueType === 5;
  const label = (key: string) => t(`walletType.form.label.${key}`);
  const required = (field: string) => t('walletType.form.validation.required', { field });
  const accountTypeLabel = (type: number) => {
    const key = `accountType.${type}`;
    return t.has(key) ? t(key) : t('status.unknown');
  };
  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<WalletTypeFormValues>({ defaultValues: defaults(tokenName) });
  const accountType = watch('accountType');
  const interestEnabled = watch('interestFeatureEnablement');
  const policyId = watch('arrangedInterestPolicyId');
  const showInterest = isTd && accountType === 2 && interestEnabled;
  const detailQuery = useWalletTypeDetailQuery(ruleId, isEdit);
  const detail = detailQuery.data;
  const hydrated = useRef<number | undefined>(undefined);
  const accountTypes = useAccountTypesQuery(tdId, isTd);
  const firstAccountType = accountTypes.data?.[0]?.accountType;
  const policyQuery = useInterestPolicyQuery({ accountType: accountType ?? 0, interestType: accountType, calculateType: accountType === 1 ? 1 : undefined }, isTd);
  const policies = policyQuery.data ?? EMPTY_POLICIES;
  const selectedPolicy = policies.find((policy) => policy.interestRuleId === policyId);

  useEffect(() => {
    if (!detail || hydrated.current === ruleId) return;
    hydrated.current = ruleId;
    reset(defaults(tokenName, detail));
  }, [detail, ruleId, reset, tokenName]);

  useEffect(() => {
    if (!isEdit && accountType == null && firstAccountType != null) setValue('accountType', firstAccountType);
  }, [accountType, firstAccountType, isEdit, setValue]);

  useEffect(() => {
    if (!showInterest) return;
    if (policyId == null && policies[0]?.interestRuleId != null) {
      setValue('arrangedInterestPolicyId', policies[0].interestRuleId);
      return;
    }
    const rate = selectedPolicy?.annualInterestRates?.[0]?.interestRate;
    setValue('arrangedInterestRate', selectedPolicy?.calculateType === 1 && rate != null ? `${rate}%` : '');
    setValue('arrangedInterestEffectiveDate', policyDate(selectedPolicy?.effectiveDate));
    setValue('saveDetails', selectedPolicy?.calculateType === 2 ? selectedPolicy.annualInterestRates : undefined);
  }, [policies, policyId, selectedPolicy, setValue, showInterest]);

  const addMutation = useAddWalletTypeMutation();
  const updateMutation = useUpdateWalletTypeMutation();
  const mutation = isEdit ? updateMutation : addMutation;
  const submitLock = useRef(false);
  const [pendingValues, setPendingValues] = useState<WalletTypeFormValues>();
  const onConfirm = () => {
    if (!pendingValues || submitLock.current) return;
    submitLock.current = true;
    const v = pendingValues;
    const payload: WalletTypeSavePayload = {
      tdId, ruleId, name: v.name, tokenName: v.tokenName,
      singleTradingLimit: limitForSubmit(v.singleTradingLimit), dailyTradingLimit: limitForSubmit(v.dailyTradingLimit),
      balanceLimit: limitForSubmit(v.balanceLimit), minimumBalance: limitForSubmit(v.minimumBalance),
      dailyRedeemLimit: limitForSubmit(v.dailyRedeemLimit),
    };
    if (isTd) {
      Object.assign(payload, {
        accountType: v.accountType, interestFeatureEnablement: showInterest ? 2 : 1,
        maintenanceFee: Number(v.maintenanceFee), maintenanceFeeCycle: v.maintenanceFeeCycle,
        monthlyMinimumBalanceFee: Number(v.monthlyMinimumBalanceFee), accountFeesWalletAddress: v.accountFeesWalletAddress,
      });
    }
    if (showInterest && selectedPolicy) {
      const negative = selectedPolicy.annualInterestRates?.some((tier) => String(tier.interestRate).startsWith('-'));
      Object.assign(payload, {
        arrangedInterestPolicyId: v.arrangedInterestPolicyId,
        arrangedInterestRate: v.arrangedInterestRate, arrangedInterestEffectiveDate: v.arrangedInterestEffectiveDate,
        saveDetails: v.saveDetails, depositInterestWalletAddress: v.depositInterestWalletAddress,
        ...(!negative && {
          accountClosureInterestWalletAddress: v.accountClosureInterestWalletAddress,
          ...(!isEdit && {
            depositInterestKeyStore: v.depositInterestKeyStore,
            depositInterestKeyStorePassword: v.depositInterestKeyStorePassword && getEncryptionData(v.depositInterestKeyStorePassword),
          }),
        }),
      });
    }
    setPendingValues(undefined);
    mutation.mutate(payload, {
      onSuccess: () => { toast.success(t('userWallet.modal.submitSuccess')); router.back(); },
      onSettled: () => { submitLock.current = false; },
    });
  };

  const failed = detailQuery.isError || (isTd && !isEdit && accountTypes.isError) || (showInterest && policyQuery.isError);
  const isLoading = (isEdit && !detail) || (isTd && !isEdit && accountTypes.isLoading);
  const disabled = failed || isLoading || (showInterest && !selectedPolicy) || mutation.isPending;
  const section = (key: string) => <><h4>{t(`walletType.form.section.${key}`)}</h4><p className="mb-4 mt-2 text-sm text-muted-foreground">{t(`walletType.form.section.${key}Desc`)}</p></>;
  const accountOptions = accountTypes.data ?? [];

  return (
    <form onSubmit={handleSubmit((values) => { if (!disabled) setPendingValues(values); })} className="space-y-4">
      <h4 className="text-lg font-semibold">{t('walletType.form.title', { type: isEdit ? t('common.edit') : t('common.new') })}</h4>
      {failed && <p role="alert" className="text-destructive">{t('walletType.loadFailed')}</p>}
      <Card className="p-6">
        {section('basic')}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {isTd && (
            <div className="w-[45%] min-w-[200px] space-y-2">
              <Controller control={control} name="accountType" rules={{ required: required(label('accountType')) }}
                render={({ field, fieldState }) => (
                  <>
                    <Label htmlFor="wt-account-type">{label('accountType')}</Label>
                    <Select value={field.value == null ? '' : String(field.value)} disabled={isEdit} onValueChange={(value) => {
                      field.onChange(Number(value));
                      setValue('interestFeatureEnablement', false);
                      setValue('arrangedInterestPolicyId', undefined);
                      setValue('depositInterestWalletAddress', undefined);
                      setValue('accountClosureInterestWalletAddress', undefined);
                    }}>
                      <SelectTrigger id="wt-account-type" aria-invalid={!!fieldState.error}>
                        {isEdit && field.value != null ? accountTypeLabel(field.value) : <SelectValue placeholder={label('accountType')} />}
                      </SelectTrigger>
                      <SelectContent>{accountOptions.map(({ accountType: type }) => type == null ? null : (
                        <SelectItem key={type} value={String(type)}>{accountTypeLabel(type)}</SelectItem>
                      ))}</SelectContent>
                    </Select>
                    {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
                  </>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={Boolean(interestEnabled)} disabled={accountType !== 2}
                  onCheckedChange={(value) => setValue('interestFeatureEnablement', value === true)} />
                {t('walletType.form.interestFeature')}
              </label>
            </div>
          )}
          <ReadOnlyField control={control} name="tokenName" label={label('tokenName')} />
        </div>
      </Card>
      <Card className="p-6">
        {section('limit')}
        <div className="flex flex-wrap justify-between gap-4">
          <Controller control={control} name="name" rules={{ required: required(label('name')) }} render={({ field, fieldState }) => (
            <div className="w-[45%] min-w-[200px] space-y-1.5">
              <Label htmlFor="wt-name">{label('name')}</Label>
              <Input {...field} id="wt-name" value={field.value ?? ''} disabled={isEdit} aria-invalid={!!fieldState.error} />
              {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
            </div>
          )} />
          {LIMIT_FIELDS.map((name) => <AmountField key={name} control={control} name={name} label={label(name)} symbol={symbol} error={errors[name]} t={t} />)}
        </div>
      </Card>
      {isTd && (
        <Card className="p-6">
          {section('fee')}
          <div className="flex flex-col gap-4">
            <AmountField control={control} name="maintenanceFee" label={label('maintenanceFee')} symbol={symbol} limit={false} error={errors.maintenanceFee} t={t}
              prefix={<Controller control={control} name="maintenanceFeeCycle" render={({ field }) => (
                <Select value={String(field.value ?? 1)} onValueChange={(value) => field.onChange(Number(value))}>
                  <SelectTrigger className="w-[120px] rounded-r-none" aria-label={label('maintenanceFee')}><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 5].map((cycle) => <SelectItem key={cycle} value={String(cycle)}>{t(`walletType.maintenanceFeeCycle.${cycle}`)}</SelectItem>)}</SelectContent>
                </Select>
              )} />}
            />
            <AmountField control={control} name="monthlyMinimumBalanceFee" label={label('monthlyMinimumBalanceFee')} symbol={symbol} limit={false} error={errors.monthlyMinimumBalanceFee} t={t} />
            <AddressField control={control} name="accountFeesWalletAddress" label={label('accountFeesWalletAddress')}
              error={errors.accountFeesWalletAddress} t={t} locked={isEdit && Boolean(detail?.accountFeesWalletAddress)} />
          </div>
        </Card>
      )}
      {showInterest && <WalletTypeInterestFields control={control} errors={errors} policies={policies} policy={selectedPolicy}
        detail={detail} isEdit={isEdit} onSelect={(id) => setValue('arrangedInterestPolicyId', id, { shouldValidate: true })} />}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.back')}</Button>
        <Button type="submit" disabled={disabled}>{t('common.submit')}</Button>
      </div>
      <WalletTypeSubmitDialog open={!!pendingValues} submitting={mutation.isPending} onClose={() => setPendingValues(undefined)} onConfirm={onConfirm} />
    </form>
  );
}
