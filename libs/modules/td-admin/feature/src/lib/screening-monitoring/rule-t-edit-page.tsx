/**
 * 第三方规则新建原型页（⚠️ MOCK: 无后端 API，保存仅为前端演示）。
 * 迁移自 td-manage rule/t_edit.tsx（1398 行）。
 */
'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Checkbox, Switch } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { toast } from '@myorg/shared/ui';
import type { TEditFormValues, TEditRiskLevelRow } from '@myorg/modules/td-admin/data-access';
import { TEDIT_COLUMN_CONFIGS, TEDIT_RULE_SOURCE_OPTIONS, TEDIT_SCAN_TIMING_OPTIONS, TEDIT_TOKEN_OPTIONS, TEDIT_RISK_LEVEL_OPTIONS, TEDIT_TRANSACTION_ACTION_OPTIONS, TEDIT_WALLET_ACTION_OPTIONS, TEDIT_TRANSACTION_TYPE_OPTIONS, TEDIT_MONITORING_FREQ_OPTIONS, TEDIT_DEFAULT_DATA } from '.';

/** 第三方 KYT（Post Transaction）规则来源。 */
const THIRD_PARTY_POST_SOURCES = ['chainalysis', 'elliptic', 'misttrack'];

type RowValidator = (value: string | number | undefined, values: TEditFormValues) => true | string;

/** 区间下限：必须小于本行上限且不小于上一行上限（旧页 ColumnConfig 校验）。 */
function rangeMinValidator(index: number): RowValidator {
  return (value, values) => {
    if (value === '' || value == null) return true;
    const rows = values.riskLevelConfigs ?? [];
    const current = rows[index];
    const previous = rows[index - 1];
    if (current?.maxValue !== '' && current?.maxValue != null && Number(value) >= Number(current.maxValue)) return 'Invalid value';
    if (previous?.maxValue !== '' && previous?.maxValue != null && Number(value) < Number(previous.maxValue)) return 'Invalid value';
    return true;
  };
}

/** 区间上限：必须大于本行下限且不大于下一行下限。 */
function rangeMaxValidator(index: number): RowValidator {
  return (value, values) => {
    if (value === '' || value == null) return true;
    const rows = values.riskLevelConfigs ?? [];
    const current = rows[index];
    const next = rows[index + 1];
    if (current?.minValue !== '' && current?.minValue != null && Number(value) <= Number(current.minValue)) return 'Invalid value';
    if (next?.minValue !== '' && next?.minValue != null && Number(value) > Number(next.minValue)) return 'Invalid value';
    return true;
  };
}

/** Risk Score 区间下限校验。 */
function scoreMinValidator(index: number): RowValidator {
  return (value, values) => {
    if (value === '' || value == null) return true;
    const current = (values.riskLevelConfigs ?? [])[index];
    if (current?.maxRiskScore != null && Number(value) >= Number(current.maxRiskScore)) return 'Invalid value';
    return true;
  };
}

/** Risk Score 区间上限校验。 */
function scoreMaxValidator(index: number): RowValidator {
  return (value, values) => {
    if (value === '' || value == null) return true;
    const current = (values.riskLevelConfigs ?? [])[index];
    if (current?.minRiskScore != null && Number(value) <= Number(current.minRiskScore)) return 'Invalid value';
    return true;
  };
}

export function RuleTEditPage() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const form = useForm<TEditFormValues>({ defaultValues: { ruleName: '', ruleSource: 'custom', scanTiming: 'pre', tokenName: 'mmfcoin', compareTo: 5, riskLevelConfigs: [], enableEmailNotification: false, emailRecipients: [] } });
  const { errors } = form.formState;
  const ruleSource = useWatch({ control: form.control, name: 'ruleSource' });
  const scanTiming = useWatch({ control: form.control, name: 'scanTiming' });
  const riskLevelConfigs = useWatch({ control: form.control, name: 'riskLevelConfigs' });
  const enableEmail = useWatch({ control: form.control, name: 'enableEmailNotification' });
  const compareTo = useWatch({ control: form.control, name: 'compareTo' });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'riskLevelConfigs' });

  const config = TEDIT_COLUMN_CONFIGS[ruleSource]?.[scanTiming] || TEDIT_COLUMN_CONFIGS.custom.pre;
  const isThirdPartyPost = THIRD_PARTY_POST_SOURCES.includes(ruleSource) && scanTiming === 'post';

  useEffect(() => {
    form.setValue('ruleSource', 'custom'); form.setValue('scanTiming', 'pre');
    form.setValue('riskLevelConfigs', [{ minValue: '', maxValue: '', riskScore: '', riskLevel: 'low', transactionAction: 'pass', walletAction: 'no_action' }, { minValue: '', maxValue: '', riskScore: '', riskLevel: 'medium', transactionAction: 'hold', walletAction: 'flag' }, { minValue: '', maxValue: '', riskScore: '', riskLevel: 'high', transactionAction: 'reject', walletAction: 'freeze' }]);
  }, []);

  useEffect(() => {
    if (!ruleSource || !scanTiming) return;
    const factory = TEDIT_DEFAULT_DATA[ruleSource]?.[scanTiming];
    if (factory) form.setValue('riskLevelConfigs', factory(ruleSource, scanTiming) as TEditRiskLevelRow[]);
    else if (config.maxRiskLevels && riskLevelConfigs?.length > config.maxRiskLevels) form.setValue('riskLevelConfigs', (riskLevelConfigs || []).slice(0, config.maxRiskLevels));
  }, [ruleSource, scanTiming]);

  useEffect(() => {
    if (enableEmail) {
      const levels = ruleSource === 'custom' ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'severe'];
      const cur = form.getValues('emailRecipients') || [];
      form.setValue('emailRecipients', levels.map((rl, i) => ({ riskLevel: rl, emails: cur[i]?.emails || '', selectAllUsers: cur[i]?.selectAllUsers || false })));
    } else form.setValue('emailRecipients', []);
  }, [ruleSource, enableEmail]);

  const onFinish = async (v: TEditFormValues) => {
    setSpinning(true);
    if (v.ruleSource === 'custom' && !v.transactionType) { toast.error('Please select transaction type'); setSpinning(false); return; }
    if (v.ruleSource === 'custom' && v.scanTiming === 'post' && !v.monitoringTime) { toast.error('Please select monitoring time'); setSpinning(false); return; }
    if (THIRD_PARTY_POST_SOURCES.includes(v.ruleSource) && v.scanTiming === 'post' && (v.monitoringFrequencyValue == null || v.monitoringFrequencyValue < 1)) { toast.error('Please enter frequency value'); setSpinning(false); return; }
    if (THIRD_PARTY_POST_SOURCES.includes(v.ruleSource) && v.scanTiming === 'post' && !v.monitoringFrequencyUnit) { toast.error('Please select frequency unit'); setSpinning(false); return; }
    const rows = v.riskLevelConfigs ?? [];
    if (rows.some(r => !r.riskLevel || (config.showTransactionAction && !r.transactionAction) || (config.showWalletAction && !r.walletAction))) {
      toast.error('Please complete the risk level and action fields'); setSpinning(false); return;
    }
    if (config.allowAdd && v.riskLevelConfigs) {
      const rls = v.riskLevelConfigs.map(r => r.riskLevel).filter(Boolean);
      if (new Set(rls).size !== rls.length) { toast.error('Risk level cannot be duplicated'); setSpinning(false); return; }
    }
    setTimeout(() => { toast.success('Rule saved successfully (MOCK)'); setSpinning(false); }, 500);
  };

  const sourceOptions = TEDIT_RULE_SOURCE_OPTIONS.flatMap(g => g.options.map(o => ({ ...o, groupLabel: g.groupLabel })));

  return (
    <form onSubmit={form.handleSubmit(onFinish)} className="space-y-6">
      <div className="bg-white shadow rounded-lg p-8">
        <h1 className="text-xl font-semibold mb-2">New Monitoring Rule</h1>
        <p className="text-gray-600 mb-8">Fill in the monitoring rule name and select a transaction type for Token.</p>
        <div className="grid grid-cols-2 gap-6 max-w-[60rem]">
          <FormField name="ruleName" label="Rule Name" required register={form.register('ruleName', { required: 'Please enter rule name', maxLength: { value: 50, message: 'Up to 50 alphanumeric characters' } })} error={errors.ruleName?.message} maxLength={50} placeholder="Up to 50 alphanumeric characters" />
          <FormSelect name="ruleSource" label="Rule Source" required control={form.control} options={sourceOptions} />
          <FormSelect name="scanTiming" label="Scan Timing" required control={form.control} options={TEDIT_SCAN_TIMING_OPTIONS} />
          <FormSelect name="tokenName" label="Token Name" required control={form.control} options={TEDIT_TOKEN_OPTIONS} />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-8">
        <h2 className="text-lg font-semibold mb-2">Risk Level & Action</h2>
        <div className="grid grid-cols-3 gap-6 mb-6 max-w-[60rem]">
          {ruleSource === 'custom' && <FormSelect name="transactionType" label="Transaction Type" required control={form.control} options={TEDIT_TRANSACTION_TYPE_OPTIONS} />}
          {ruleSource === 'custom' && scanTiming === 'post' ? <FormField name="monitoringTime" label="Monitoring Time" required register={form.register('monitoringTime', { required: 'Please select monitoring time' })} error={errors.monitoringTime?.message} type="time" step={1} /> : null}
          {isThirdPartyPost ? (
            <div>
              <div className="mb-1.5 block text-sm font-medium text-foreground">Monitoring Frequency<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></div>
              <div className="flex gap-2">
                <div className="w-[8rem] [&_label]:sr-only"><FormField name="monitoringFrequencyValue" label="Frequency Value" register={form.register('monitoringFrequencyValue', { required: 'Please enter frequency value', min: { value: 1, message: 'Must be at least 1' } })} error={errors.monitoringFrequencyValue?.message} type="number" min={1} /></div>
                <div className="w-32 [&_label]:sr-only"><FormSelect name="monitoringFrequencyUnit" label="Frequency Unit" required control={form.control} options={TEDIT_MONITORING_FREQ_OPTIONS} placeholder="Seconds" /></div>
              </div>
            </div>
          ) : null}
          <div>
            <FormField name="compareTo" label="Compared to Past" required register={form.register('compareTo', { required: 'Please enter compare value', min: { value: 1, message: 'Must be at least 1' } })} error={errors.compareTo?.message} type="number" min={1} placeholder="5" />
            <div className="text-xs text-gray-600 mt-1">Compare over the last {compareTo || 5} days.</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
          {config.showPercentage && <div className="col-span-3"><span className="text-destructive" aria-hidden="true">*</span>{config.percentageAsRange ? 'Percentage' : 'Metric Threshold'}</div>}
          {config.showRiskScore && <div className="col-span-2"><span className="text-destructive" aria-hidden="true">*</span>Risk Score</div>}
          {config.showRiskLevel && <div className="col-span-2"><span className="text-destructive" aria-hidden="true">*</span>Risk Level</div>}
          {config.showTransactionAction && <div className="col-span-2"><span className="text-destructive" aria-hidden="true">*</span>Transaction Action</div>}
          {config.showWalletAction && <div className="col-span-2"><span className="text-destructive" aria-hidden="true">*</span>Wallet Action</div>}
        </div>

        {fields.map((field, idx) => {
          const rowErrors = errors.riskLevelConfigs?.[idx];
          return (
            <div key={field.id} className="grid grid-cols-12 gap-4 mb-3 items-center">
              {config.showPercentage && (config.percentageAsRange ? <div className="col-span-3 flex gap-1"><FormField name={`riskLevelConfigs.${idx}.minValue`} label="" register={form.register(`riskLevelConfigs.${idx}.minValue`, { required: 'Required', validate: rangeMinValidator(idx) })} error={rowErrors?.minValue?.message} type="number" /><span>-</span><FormField name={`riskLevelConfigs.${idx}.maxValue`} label="" register={form.register(`riskLevelConfigs.${idx}.maxValue`, { required: 'Required', validate: rangeMaxValidator(idx) })} error={rowErrors?.maxValue?.message} type="number" /></div> : <div className="col-span-3"><FormField name={`riskLevelConfigs.${idx}.minValue`} label="" register={form.register(`riskLevelConfigs.${idx}.minValue`, { required: 'Required' })} error={rowErrors?.minValue?.message} type="number" /></div>)}
              {config.showRiskScore && <div className="col-span-2">{config.riskScoreAsRange ? <div className="flex gap-1"><FormField name={`riskLevelConfigs.${idx}.minRiskScore`} label="" register={form.register(`riskLevelConfigs.${idx}.minRiskScore`, { required: 'Required', validate: scoreMinValidator(idx) })} error={rowErrors?.minRiskScore?.message} type="number" /><span>-</span><FormField name={`riskLevelConfigs.${idx}.maxRiskScore`} label="" register={form.register(`riskLevelConfigs.${idx}.maxRiskScore`, { required: 'Required', validate: scoreMaxValidator(idx) })} error={rowErrors?.maxRiskScore?.message} type="number" /></div> : <FormField name={`riskLevelConfigs.${idx}.riskScore`} label="" register={form.register(`riskLevelConfigs.${idx}.riskScore`, { required: 'Required' })} error={rowErrors?.riskScore?.message} />}</div>}
              {config.showRiskLevel && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.riskLevel`} label="" control={form.control} options={TEDIT_RISK_LEVEL_OPTIONS} error={rowErrors?.riskLevel?.message} /></div>}
              {config.showTransactionAction && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.transactionAction`} label="" control={form.control} options={TEDIT_TRANSACTION_ACTION_OPTIONS} error={rowErrors?.transactionAction?.message} /></div>}
              {config.showWalletAction && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.walletAction`} label="" control={form.control} options={TEDIT_WALLET_ACTION_OPTIONS} error={rowErrors?.walletAction?.message} /></div>}
              {fields.length > 1 && idx === fields.length - 1 && <button type="button" className="text-red-500" onClick={() => remove(idx)}>✕</button>}
            </div>
          );
        })}
        {config.allowAdd && fields.length < (config.maxRiskLevels || 3) && <Button type="button" variant="ghost" onClick={() => append({ minValue: '', maxValue: '', riskScore: '', riskLevel: '', transactionAction: '', walletAction: '' })}>Add</Button>}
      </div>

      <div className="bg-white shadow rounded-lg p-8">
        <h2 className="text-lg font-semibold mb-2">Risk Alert Configuration</h2>
        <div className="mb-4 flex items-center gap-3"><span>Enable Email Notification</span><Switch checked={Boolean(enableEmail)} onCheckedChange={(v) => form.setValue('enableEmailNotification', v)} /></div>
        {enableEmail && <EmailRecipientFields form={form} />}
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>Back</Button>
        <Button type="submit" disabled={spinning}>Save</Button>
      </div>
    </form>
  );
}

function EmailRecipientFields({ form }: { form: UseFormReturn<TEditFormValues> }) {
  const { fields } = useFieldArray({ control: form.control, name: 'emailRecipients' });
  const emailRecipients = useWatch({ control: form.control, name: 'emailRecipients' });
  return (
    <div className="mt-4 space-y-6">
      {fields.map((field, idx) => {
        const rl = emailRecipients?.[idx]?.riskLevel;
        const label = TEDIT_RISK_LEVEL_OPTIONS.find(o => o.value === rl)?.label || 'Risk Level';
        return (
          <div key={field.id}>
            <div className="text-gray-700 font-medium mb-2">{label}-Risk Email Recipients</div>
            <FormField name={`emailRecipients.${idx}.emails`} label="" register={form.register(`emailRecipients.${idx}.emails`, { validate: (val: string) => { if (!val) return true; const emails = val.split(',').map((e: string) => e.trim()); if (emails.length > 20) return 'Max 20 emails'; const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/; return emails.every((e: string) => re.test(e)) ? true : 'Invalid email format'; } })} placeholder="email-1@email.com, email-2@email.com..." />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <Checkbox
                checked={Boolean(form.watch(`emailRecipients.${idx}.selectAllUsers`))}
                onCheckedChange={(checked) => form.setValue(`emailRecipients.${idx}.selectAllUsers`, checked === true)}
              />
              <span>Select all users with &quot;Screening &amp; Monitoring&quot; access.</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
