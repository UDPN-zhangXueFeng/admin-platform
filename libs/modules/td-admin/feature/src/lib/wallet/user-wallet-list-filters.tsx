'use client';

import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useBlockchainsQuery, useStablecoinsQuery, useTokenTypesQuery, type UserWalletFilters } from '@myorg/modules/td-admin/data-access';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { QueryForm } from '../query-form';
import { ALL_VALUE } from './wallet.constants';
import { dayBoundary, walletFilterNumber } from './user-wallet-rules';
import { WalletLoadError } from './user-wallet-table';

const defaults = (stablecoinId: string) => ({
  walletAddress: '', spName: '', stablecoinId, tokenType: ALL_VALUE, blockchainId: ALL_VALUE,
  startCreateTime: '', endCreateTime: '', state: ALL_VALUE, custodyModel: ALL_VALUE,
  kycRequired: ALL_VALUE, submissionPolicyStatic: ALL_VALUE,
});

export function UserWalletListFilters({ stablecoinId, onApply, onReset }: {
  stablecoinId: string;
  onApply: (filters: UserWalletFilters) => void;
  onReset: () => void;
}) {
  const t = useTranslations('modules.wallet');
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: defaults(stablecoinId) });
  const stablecoins = useStablecoinsQuery();
  const blockchains = useBlockchainsQuery();
  const tokenTypes = useTokenTypesQuery();
  const all = { value: ALL_VALUE, label: t('common.all') };
  const tokenOptions = (tokenTypes.data ?? []).flatMap((item) => item.tokenTypeId == null ? [] : [{
    value: String(item.tokenTypeId), label: item.tokenTypeName ?? String(item.tokenTypeId), disabled: item.status === 0,
  }]);
  const chainOptions = (blockchains.data ?? []).flatMap((item) => item.key == null ? [] : [{
    value: String(item.key), label: item.value ?? String(item.key), disabled: item.status !== 1,
  }]);
  const select = (name: 'state' | 'stablecoinId' | 'custodyModel' | 'kycRequired' | 'submissionPolicyStatic', label: string,
    options: { value: string; label: string }[]) => (
    <FormSelect key={name} name={name} control={control} label={label} options={[all, ...options]} />
  );
  const optionSelect = (name: 'tokenType' | 'blockchainId', label: string, options: { value: string; label: string; disabled?: boolean }[]) => (
    <Controller key={name} name={name} control={control} render={({ field }) => (
      <div className="space-y-1.5">
        <label htmlFor={`user-wallet-${name}`} className="text-sm font-medium">{label}</label>
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={`user-wallet-${name}`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{[all, ...options].map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={'disabled' in option && option.disabled === true}>{option.label}</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
    )} />
  );

  return (
    <form onSubmit={handleSubmit((values) => onApply({
      walletAddress: values.walletAddress.trim() || undefined,
      spName: values.spName.trim() || undefined,
      stablecoinId: walletFilterNumber(values.stablecoinId),
      tokenType: walletFilterNumber(values.tokenType),
      blockchainId: (blockchains.data ?? []).find((item) => String(item.key) === values.blockchainId)?.key,
      startCreateTime: dayBoundary(values.startCreateTime), endCreateTime: dayBoundary(values.endCreateTime, true),
      state: walletFilterNumber(values.state), custodyModel: walletFilterNumber(values.custodyModel),
      kycRequired: walletFilterNumber(values.kycRequired),
      submissionPolicyStatic: values.submissionPolicyStatic === ALL_VALUE ? undefined : values.submissionPolicyStatic,
    }))}>
      <QueryForm queryType="submit" queryLabel={t('common.query')} resetLabel={t('common.reset')}
        onReset={() => { reset(defaults(ALL_VALUE)); onReset(); }}
        fields={[
          <FormField key="walletAddress" name="walletAddress" label={t('userWallet.column.walletAddress')}
            register={register('walletAddress')} placeholder={t('userWallet.placeholder.walletAddress')} />,
          select('stablecoinId', t('userWallet.column.tokenName'), (stablecoins.data ?? []).flatMap((item) => (
            item.stablecoinId == null ? [] : [{ value: String(item.stablecoinId), label: item.name ?? String(item.stablecoinId) }]
          ))),
          optionSelect('tokenType', t('userWallet.column.tokenType'), tokenOptions),
        ]}
        advancedFields={[
          <FormField key="spName" name="spName" label={t('userWallet.column.sp')}
            register={register('spName')} placeholder={t('userWallet.placeholder.sp')} />,
          optionSelect('blockchainId', t('userWallet.column.blockchain'), chainOptions),
          <FormDateRangePicker key="createTime" startName="startCreateTime" endName="endCreateTime" control={control} label={t('common.createTime')} />,
          select('state', t('common.status'), [
            { value: '0', label: t('status.processing') }, { value: '1', label: t('status.active') },
            { value: '2', label: t('status.frozen') }, { value: '3', label: t('userWallet.column.stateRejected') },
          ]),
          select('custodyModel', t('userWallet.column.custodyModel'), [
            { value: '1', label: t('custodyModel.issuerCustody') }, { value: '2', label: t('custodyModel.spCustody') },
            { value: '3', label: t('custodyModel.selfCustody') },
          ]),
          select('kycRequired', t('userWallet.column.kycRequired'), [
            { value: '1', label: t('kyc.yes') }, { value: '0', label: t('kyc.no') },
          ]),
          select('submissionPolicyStatic', t('userWallet.column.submissionPolicy'), [
            { value: 'sp', label: t('userWallet.submissionPolicy.sp') },
            { value: 'direct', label: t('userWallet.submissionPolicy.direct') },
          ]),
        ]}
      />
      {(stablecoins.isError || blockchains.isError || tokenTypes.isError) && <WalletLoadError retry={() => {
        if (stablecoins.isError) void stablecoins.refetch();
        if (blockchains.isError) void blockchains.refetch();
        if (tokenTypes.isError) void tokenTypes.refetch();
      }} />}
    </form>
  );
}
