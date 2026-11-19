'use client';

import { Controller, type Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import {
  useAuditTrailTokenTypeListQuery,
  useBlockchainListQuery,
  useStablecoinSearchesQuery,
} from '@myorg/modules/td-admin/data-access/lib/audit-trail';
import { QueryForm } from '../query-form';
import { ALL_VALUE, TX_TYPE_VALUES } from './audit-trail.constants';
import type { AuditTrailFilterForm } from './audit-trail.filters';
import type { UseFormRegister } from 'react-hook-form';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

function BackendFilterSelect({ control, name, label, options }: {
  control: Control<AuditTrailFilterForm>;
  name: 'tokenType' | 'blockchainId';
  label: string;
  options: Option[];
}) {
  const id = `audit-trail-${name}`;
  const seen = new Set<string>();
  const validOptions = options.filter(({ value }) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
              {validOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

export function AuditTrailQueryForm({ register, control, onReset }: {
  register: UseFormRegister<AuditTrailFilterForm>;
  control: Control<AuditTrailFilterForm>;
  onReset: () => void;
}) {
  const t = useTranslations('modules.audit-trail');
  const { data: tokens } = useStablecoinSearchesQuery();
  const { data: tokenTypes } = useAuditTrailTokenTypeListQuery();
  const { data: chains } = useBlockchainListQuery();
  const all = { value: ALL_VALUE, label: t('filter.all') };
  const textField = (name: 'traceId' | 'txFrom' | 'txTo' | 'txHash') => (
    <FormField key={name} name={name} label={t(`field.${name}`)} register={register(name)} placeholder={t(`field.${name}`)} />
  );

  return (
    <QueryForm
      queryType="submit"
      fields={[
        textField('traceId'),
        <FormSelect key="txType" name="txType" control={control} label={t('field.txType')}
          options={[all, ...TX_TYPE_VALUES.map((value) => ({ value: String(value), label: t(`txType.${value}`) }))]} />,
        <FormDateRangePicker key="txTime" startName="txTimeFrom" endName="txTimeTo" control={control} label={t('field.txTime')} />,
      ]}
      advancedFields={[
        textField('txFrom'),
        textField('txTo'),
        <FormSelect key="tokenName" name="tokenName" control={control} label={t('field.tokenName')}
          options={[all, ...(tokens ?? []).map(({ name }) => ({ value: name ?? '', label: name ?? '' }))]} />,
        <BackendFilterSelect key="tokenType" name="tokenType" control={control} label={t('field.tokenType')}
          options={[all, ...(tokenTypes ?? []).map((item) => ({
            value: String(item.tokenTypeId ?? ''), label: item.tokenTypeName, disabled: item.status === 0,
          }))]} />,
        <BackendFilterSelect key="blockchainId" name="blockchainId" control={control} label={t('field.blockchain')}
          options={[all, ...(chains ?? []).map((chain) => ({
            value: String(chain.key ?? ''), label: chain.value ?? '', disabled: chain.status !== 1,
          }))]} />,
        textField('txHash'),
      ]}
      onReset={onReset}
      queryLabel={t('filter.query')}
      resetLabel={t('filter.reset')}
    />
  );
}
