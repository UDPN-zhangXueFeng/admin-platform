/**
 * 第三方规则新建原型页（⚠️ MOCK: 无后端 API，保存仅为前端演示）。
 * 迁移自 td-manage rule/t_edit.tsx（1398 行）。
 */
'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Input, InputNumber, Select, Switch, TimePicker } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { toast } from '@myorg/shared/ui-toast';
import type { TEditFormValues, TEditRiskLevelRow } from '@myorg/modules/screening-monitoring/data-access';
import { TEDIT_COLUMN_CONFIGS, TEDIT_RULE_SOURCE_OPTIONS, TEDIT_SCAN_TIMING_OPTIONS, TEDIT_TOKEN_OPTIONS, TEDIT_RISK_LEVEL_OPTIONS, TEDIT_TRANSACTION_ACTION_OPTIONS, TEDIT_WALLET_ACTION_OPTIONS, TEDIT_TRANSACTION_TYPE_OPTIONS, TEDIT_MONITORING_FREQ_OPTIONS, TEDIT_DEFAULT_DATA } from '@myorg/modules/screening-monitoring/util';

export function RuleTEditPage() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const form = useForm<TEditFormValues>({ defaultValues: { ruleName: '', ruleSource: 'custom', scanTiming: 'pre', tokenName: 'mmfcoin', compareTo: 5, riskLevelConfigs: [], enableEmailNotification: false, emailRecipients: [] } });
  const ruleSource = useWatch({ control: form.control, name: 'ruleSource' });
  const scanTiming = useWatch({ control: form.control, name: 'scanTiming' });
  const riskLevelConfigs = useWatch({ control: form.control, name: 'riskLevelConfigs' });
  const enableEmail = useWatch({ control: form.control, name: 'enableEmailNotification' });
  const compareTo = useWatch({ control: form.control, name: 'compareTo' });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'riskLevelConfigs' });

  const config = TEDIT_COLUMN_CONFIGS[ruleSource]?.[scanTiming] || TEDIT_COLUMN_CONFIGS.custom.pre;

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
          <FormField name="ruleName" label="Rule Name" control={form.control} rules={{ required: true }} maxLength={50} placeholder="Up to 50 alphanumeric characters" />
          <FormSelect name="ruleSource" label="Rule Source" control={form.control} options={sourceOptions} rules={{ required: true }} />
          <FormSelect name="scanTiming" label="Scan Timing" control={form.control} options={TEDIT_SCAN_TIMING_OPTIONS} rules={{ required: true }} />
          <FormSelect name="tokenName" label="Token Name" control={form.control} options={TEDIT_TOKEN_OPTIONS} rules={{ required: true }} />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-8">
        <h2 className="text-lg font-semibold mb-2">Risk Level & Action</h2>
        <div className="grid grid-cols-3 gap-6 mb-6 max-w-[60rem]">
          {ruleSource === 'custom' && <FormSelect name="transactionType" label="Transaction Type" control={form.control} options={TEDIT_TRANSACTION_TYPE_OPTIONS} />}
          {ruleSource === 'custom' && scanTiming === 'post' ? <FormField name="monitoringTime" label="Monitoring Time" control={form.control} type="time" /> : null}
          <div><FormField name="compareTo" label="Compared to Past" control={form.control} type="number" rules={{ required: true }} /><div className="text-xs text-gray-600 mt-1">Compare over the last {compareTo || 5} days.</div></div>
        </div>

        <div className="mb-4 grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
          {config.showPercentage && <div className="col-span-3">{config.percentageAsRange ? 'Percentage' : 'Metric Threshold'}</div>}
          {config.showRiskScore && <div className="col-span-2">Risk Score</div>}
          {config.showRiskLevel && <div className="col-span-2">Risk Level</div>}
          {config.showTransactionAction && <div className="col-span-2">Transaction Action</div>}
          {config.showWalletAction && <div className="col-span-2">Wallet Action</div>}
        </div>

        {fields.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-12 gap-4 mb-3 items-center">
            {config.showPercentage && (config.percentageAsRange ? <div className="col-span-3 flex gap-1"><FormField name={`riskLevelConfigs.${idx}.minValue`} label="" control={form.control} type="number" /><span>-</span><FormField name={`riskLevelConfigs.${idx}.maxValue`} label="" control={form.control} type="number" /></div> : <div className="col-span-3"><FormField name={`riskLevelConfigs.${idx}.minValue`} label="" control={form.control} type="number" /></div>)}
            {config.showRiskScore && <div className="col-span-2">{config.riskScoreAsRange ? <div className="flex gap-1"><FormField name={`riskLevelConfigs.${idx}.minRiskScore`} label="" control={form.control} type="number" /><span>-</span><FormField name={`riskLevelConfigs.${idx}.maxRiskScore`} label="" control={form.control} type="number" /></div> : <FormField name={`riskLevelConfigs.${idx}.riskScore`} label="" control={form.control} />}</div>}
            {config.showRiskLevel && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.riskLevel`} label="" control={form.control} options={TEDIT_RISK_LEVEL_OPTIONS} /></div>}
            {config.showTransactionAction && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.transactionAction`} label="" control={form.control} options={TEDIT_TRANSACTION_ACTION_OPTIONS} /></div>}
            {config.showWalletAction && <div className="col-span-2"><FormSelect name={`riskLevelConfigs.${idx}.walletAction`} label="" control={form.control} options={TEDIT_WALLET_ACTION_OPTIONS} /></div>}
            {fields.length > 1 && idx === fields.length - 1 && <button type="button" className="text-red-500" onClick={() => remove(idx)}>✕</button>}
          </div>
        ))}
        {config.allowAdd && fields.length < (config.maxRiskLevels || 3) && <Button type="button" variant="ghost" onClick={() => append({ minValue: '', maxValue: '', riskScore: '', riskLevel: '', transactionAction: '', walletAction: '' })}>Add</Button>}
      </div>

      <div className="bg-white shadow rounded-lg p-8">
        <h2 className="text-lg font-semibold mb-2">Risk Alert Configuration</h2>
        <div className="mb-4 flex items-center gap-3"><span>Enable Email Notification</span><Switch name="enableEmailNotification" control={form.control} /></div>
        {enableEmail && <EmailRecipientFields form={form} ruleSource={ruleSource} />}
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>Back</Button>
        <Button type="submit" disabled={spinning}>Save</Button>
      </div>
    </form>
  );
}

function EmailRecipientFields({ form, ruleSource }: { form: ReturnType<typeof useForm<TEditFormValues>>; ruleSource: string }) {
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
            <FormField name={`emailRecipients.${idx}.emails`} label="" control={form.control} rules={{ validate: (val) => { if (!val) return true; const emails = val.split(',').map((e: string) => e.trim()); if (emails.length > 20) return 'Max 20 emails'; const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/; return emails.every((e: string) => re.test(e)) ? true : 'Invalid email format'; } }} placeholder="email-1@email.com, email-2@email.com..." />
          </div>
        );
      })}
    </div>
  );
}
