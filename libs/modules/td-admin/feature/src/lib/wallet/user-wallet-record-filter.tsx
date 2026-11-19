'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { UserWalletRecordFilters } from '@myorg/modules/td-admin/data-access';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { QueryForm } from '../query-form';
import { ALL_VALUE } from './wallet.constants';
import { dayBoundary, walletFilterNumber } from './user-wallet-rules';

type Variant = 'operations' | 'accrual' | 'distribution' | 'authorization' | 'authorized';
const dates = {
  accrual: ['accrualTimeStart', 'accrualTimeEnd', 'accrualTime'],
  distribution: ['payableTimeStart', 'payableTimeEnd', 'payableOn'],
  authorization: ['operationStartTime', 'operationEndTime', 'operationTime'],
  authorized: ['operationStartTime', 'operationEndTime', 'operationTime'],
} as const;

export function UserWalletRecordFilter({ variant, onApply, onReset }: {
  variant: Variant;
  onApply: (filters: UserWalletRecordFilters) => void;
  onReset: () => void;
}) {
  const t = useTranslations('modules.wallet');
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: {
    start: '', end: '', operationType: ALL_VALUE, feeType: ALL_VALUE, authorizedAddress: '', status: ALL_VALUE, txHash: '',
  } });
  const history = variant === 'authorization' || variant === 'authorized';
  const range = variant === 'operations' ? undefined : dates[variant];
  const options = (key: string, values: number[]) => [
    { value: ALL_VALUE, label: t('common.all') },
    ...values.map((value) => ({ value: String(value), label: t(`${key}.${value}`) })),
  ];
  const addressLabel = t(`userWallet.column.${variant === 'authorized' ? 'fromWallet' : 'toWallet'}`);
  return (
    <form onSubmit={handleSubmit((values) => {
      const filter: UserWalletRecordFilters = {};
      if (range) {
        filter[range[0]] = dayBoundary(values.start);
        filter[range[1]] = dayBoundary(values.end, true);
      }
      if (variant === 'operations' || history) filter.operationType = walletFilterNumber(values.operationType);
      if (variant === 'accrual') filter.feeType = walletFilterNumber(values.feeType);
      if (history) {
        filter.authorizedAddress = values.authorizedAddress.trim() || undefined;
        filter.status = walletFilterNumber(values.status);
        filter.txHash = values.txHash.trim() || undefined;
      }
      onApply(filter);
    })}>
      <QueryForm queryType="submit" queryLabel={t('common.query')} resetLabel={t('common.reset')}
        onReset={() => { reset(); onReset(); }} fields={[
          ...(history ? [<FormField key="address" name="authorizedAddress" label={addressLabel} register={register('authorizedAddress')} />] : []),
          ...(variant === 'operations' || history ? [<FormSelect key="operationType" name="operationType" control={control}
            label={t('userWallet.column.operateType')} options={history ? options('authorizedOperationType', [1, 2]) : options('operateType', [1, 2, 3, 5, 6, 7])} />] : []),
          ...(range ? [<FormDateRangePicker key="range" control={control} startName="start" endName="end" label={variant === 'distribution' ? t('userWallet.filter.appliedDate') : t(`userWallet.column.${range[2]}`)} />] : []),
          ...(variant === 'accrual' ? [<FormSelect key="feeType" name="feeType" control={control}
            label={t('userWallet.column.feeType')} options={options('userFeeType', [10, 20, 25, 30])} />] : []),
        ]} advancedFields={history ? [
          <FormSelect key="status" name="status" control={control} label={t('common.status')} options={options('commonTaskStatus', [30, 35, 40])} />,
          <FormField key="hash" name="txHash" label={t('userWallet.column.txHash')} register={register('txHash')} />,
        ] : undefined}
      />
    </form>
  );
}
