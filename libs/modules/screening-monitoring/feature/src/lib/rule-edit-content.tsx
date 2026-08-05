'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import { Button, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { toast } from '@myorg/shared/ui';
import type { RuleFormValues, SaveDetailFormItem } from '@myorg/modules/screening-monitoring/data-access';
import { useBusinessTypeList, useEditRule, useRuleDetail, useSaveRule, useStablecoinOptions } from '@myorg/modules/screening-monitoring/data-access';
import { HANDLE_TYPE_MAP, RISK_LEVEL_MAP } from '@myorg/modules/screening-monitoring/util';

export function RuleEditContent() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter(); const sp = useSearchParams(); const id = sp.get('id'); const isEdit = Boolean(id); const ruleId = Number(id);
  const { data: tdList } = useStablecoinOptions(); const { data: bizTypes } = useBusinessTypeList();
  const { data: existing } = useRuleDetail(isEdit ? ruleId : 0); const [loaded, setLoaded] = useState(false);
  const saveMut = useSaveRule(); const editMut = useEditRule(); const [submitting, setSubmitting] = useState(false);
  const [unitList, setUnitList] = useState<{ monitorName: string; monitorUnit: number }[]>([]);

  const form = useForm<RuleFormValues>({ defaultValues: { ruleName: '', tokenId: 0, businessType: 0, monitorFrequency: '', monitorFrequencyType: 0, compareTo: 5, saveDetails: [], turnOnAlert: false, alertList: [] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'saveDetails' });
  const businessType = useWatch({ control: form.control, name: 'businessType' });
  const saveDetails = useWatch({ control: form.control, name: 'saveDetails' });
  const turnOnAlert = useWatch({ control: form.control, name: 'turnOnAlert' });
  const compareTo = useWatch({ control: form.control, name: 'compareTo' });

  // Init
  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setLoaded(true);
      const { ruleName, tokenId, businessType: bt, monitorFrequency, monitorUnit, detailList, alertList } = existing;
      form.setValue('ruleName', ruleName); form.setValue('tokenId', tokenId); form.setValue('businessType', bt);
      form.setValue('monitorFrequency', bt === 40 || bt === 50 ? monitorFrequency : Number(monitorFrequency));
      form.setValue('monitorFrequencyType', monitorUnit); form.setValue('compareTo', 5);
      form.setValue('saveDetails', (detailList || []).map((el: SaveDetailFormItem) => ({ minValue: el.minValue, maxValue: el.maxValue, riskScoring: el.riskScoring, priority: el.priority, handleType: el.handleType })));
      form.setValue('turnOnAlert', Boolean(alertList?.length));
      form.setValue('alertList', (alertList || []).map((a: { contactInfo: string; priority: number; notifyType: number }) => ({ contactInfo: a.contactInfo, priority: a.priority, notifyType: a.notifyType })));
      if (bizTypes) { const cur = bizTypes.find((b: { value: number }) => b.value === bt); if (cur) setUnitList(cur.unitList); }
    } else if (!isEdit && bizTypes && bizTypes.length && !loaded) {
      setLoaded(true);
      const first = bizTypes[0];
      form.setValue('businessType', first.value); setUnitList(first.unitList);
      form.setValue('monitorFrequencyType', first.unitList[0]?.monitorUnit);
      form.setValue('saveDetails', [{ minValue: '', maxValue: '', riskScoring: '', priority: '', handleType: '' }]);
    }
  }, [isEdit, existing, bizTypes, loaded, form]);

  // Auto-fill tokenId for create
  useEffect(() => { if (!isEdit && tdList && tdList.length) { form.setValue('tokenId', Number(tdList[0]?.value)); } }, [isEdit, tdList]);

  // Alert list sync
  useEffect(() => {
    if (saveDetails?.length) {
      if (!turnOnAlert) { form.setValue('alertList', []); } else {
        const cur = form.getValues('alertList') || [];
        form.setValue('alertList', saveDetails.map((el, i) => ({ contactInfo: cur[i]?.contactInfo || '', priority: Number(el.priority), notifyType: 1 })));
      }
    }
  }, [saveDetails, turnOnAlert]);

  const onSubmit = async (v: RuleFormValues) => {
    setSubmitting(true);
    try {
      const { turnOnAlert: _ta, monitorFrequency, monitorFrequencyType, saveDetails: _sd, alertList: _al, ...rest } = v;
      const isTimeType = v.businessType === 40 || v.businessType === 50;
      const mf = isTimeType ? monitorFrequency : monitorFrequency;
      const mft = isTimeType ? (unitList[0]?.monitorUnit || 1) : monitorFrequencyType;
      const params = { ...rest, monitorFrequency: mf, monitorFrequencyType: mft, saveDetails: _sd, alertList: _ta ? _al : [], compareTo: isTimeType ? v.compareTo : undefined };
      if (isEdit) await editMut.mutateAsync({ ...params, ruleId } as never);
      else await saveMut.mutateAsync(params as never);
      toast.success(tc('PUB_Success')); router.back();
    } finally { setSubmitting(false); }
  };

  const isTimeType = businessType === 40 || businessType === 50;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white shadow p-10 pt-4">
      <h4 className="text-lg font-medium mb-6">{t('screening_monitoring_0005').replace('****', isEdit ? tc('PUB_Edit') : tc('PUB_New'))}</h4>
      {/* Basic Info */}
      <div className="flex justify-between py-6 mb-6 border-b">
        <div className="w-[20%]"><span className="font-bold">{t('screening_monitoring_0004')}</span><p className="text-sm text-muted-foreground">{t('screening_monitoring_0006')}</p></div>
        <div className="w-[78%] flex justify-between">
          <div className="w-[35%]"><FormField name="ruleName" label={t('screening_monitoring_0000')} register={form.register('ruleName', { required: true })} disabled={isEdit} maxLength={50} placeholder={t('screening_monitoring_0052')} /></div>
          <div className="w-[15%]"><FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={form.control} options={tdList || []} disabled={isEdit} /></div>
          <div className="w-[43%]">
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('screening_monitoring_0002')}</label>
            <Select value={String(businessType ?? '')} onValueChange={(val) => { const cur = (bizTypes || []).find(b => String(b.value) === val); setUnitList(cur?.unitList || []); form.setValue('businessType', Number(val)); form.setValue('compareTo', 0); form.setValue('monitorFrequency', ''); form.setValue('monitorFrequencyType', cur?.unitList?.[0]?.monitorUnit || 0); form.setValue('saveDetails', [{ minValue: '', maxValue: '', riskScoring: '', priority: '', handleType: '' }]); }} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(bizTypes || []).map(b => <SelectItem key={String(b.value)} value={String(b.value)}>{b.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Monitor Config + saveDetails */}
      <div className="flex justify-between py-6 mb-6 border-b">
        <div className="w-[20%]"><span className="font-bold">{t('screening_monitoring_0007')}</span><p className="text-sm text-muted-foreground">{t('screening_monitoring_0008')}</p></div>
        <div className="w-[78%]">
          {isTimeType ? (
            <div className="flex flex-col">
              <div className="flex gap-4">
                <div className="w-[20%]"><FormField name="monitorFrequency" label={t('screening_monitoring_0016')} register={form.register('monitorFrequency', { required: true })} type="time" /></div>
                <div className="w-[20%]"><FormField name="compareTo" label={t('screening_monitoring_0026')} register={form.register('compareTo', { required: true })} type="number" /></div>
              </div>
              <div className="text-xs text-muted-foreground -mt-2 mb-6">{t('screening_monitoring_0027').replace('****', String(compareTo || 5))}</div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="w-[25%]"><FormField name="monitorFrequency" label={t('screening_monitoring_0003')} register={form.register('monitorFrequency', { required: true })} type="number" /></div>
              <div className="w-[15%]"><FormSelect name="monitorFrequencyType" label=" " control={form.control} options={unitList.map(u => ({ label: u.monitorName, value: String(u.monitorUnit) }))} /></div>
            </div>
          )}

          {fields.map((field, idx) => (
            <div key={field.id} className="flex w-full mb-4 items-center gap-2">
              <div className="w-[20%]"><FormField name={`saveDetails.${idx}.minValue`} label={isTimeType ? t('screening_monitoring_0028') : t('screening_monitoring_0009')} register={form.register(`saveDetails.${idx}.minValue`, { required: true, validate: (val: string | number, fv: RuleFormValues) => { const cur = fv.saveDetails?.[idx]; const prev = fv.saveDetails?.[idx - 1]; if (cur?.maxValue && Number(val) >= Number(cur.maxValue)) return t('screening_monitoring_0078'); if (prev && Number(val) < Number(prev.maxValue)) return t('screening_monitoring_0078'); return true; } })} type="number" /></div>
              <span>-</span>
              <div className="w-[20%]"><FormField name={`saveDetails.${idx}.maxValue`} label=" " register={form.register(`saveDetails.${idx}.maxValue`, { required: true, validate: (val: string | number, fv: RuleFormValues) => { const cur = fv.saveDetails?.[idx]; const next = fv.saveDetails?.[idx + 1]; if (cur && Number(val) <= Number(cur.minValue)) return t('screening_monitoring_0078'); if (next?.minValue && Number(val) > Number(next.minValue)) return t('screening_monitoring_0078'); return true; } })} type="number" /></div>
              <div className="w-[18%]"><FormField name={`saveDetails.${idx}.riskScoring`} label={t('screening_monitoring_0010')} register={form.register(`saveDetails.${idx}.riskScoring`, { required: true })} /></div>
              <div className="w-[16%]"><FormSelect name={`saveDetails.${idx}.priority`} label={t('screening_monitoring_0011')} control={form.control} options={[20, 30, 40].map(v => ({ label: t(RISK_LEVEL_MAP[v]), value: String(v) }))} /></div>
              <div className="w-[17%]"><FormSelect name={`saveDetails.${idx}.handleType`} label={t('screening_monitoring_0032')} control={form.control} options={[2, 1].map(v => ({ label: t(HANDLE_TYPE_MAP[v]), value: String(v) }))} /></div>
              {fields.length > 1 && fields.length === idx + 1 && <button type="button" className="text-red-500 pt-6" onClick={() => remove(idx)}>✕</button>}
            </div>
          ))}
          {fields.length < 3 && <Button type="button" variant="outline" onClick={() => append({ minValue: '', maxValue: '', riskScoring: '', priority: '', handleType: '' })}>{tc('PUB_Add')}</Button>}
        </div>
      </div>

      {/* Alert Config */}
      <div className="flex justify-between py-6 mb-6 border-b">
        <div className="w-[20%]"><span className="font-bold">{t('screening_monitoring_0029')}</span><p className="text-sm text-muted-foreground">{t('screening_monitoring_0030')}</p></div>
        <div className="w-[78%]">
          <div className="mb-4"><label className="mr-3">{t('screening_monitoring_0031')}</label><Switch checked={Boolean(turnOnAlert)} onCheckedChange={(v) => form.setValue('turnOnAlert', v)} /></div>
          {turnOnAlert && <AlertListFields form={form} t={t} />}
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-10">
        <Button type="button" variant="outline" onClick={() => router.back()}>{tc('PUB_GoBack')}</Button>
        <Button type="submit" disabled={submitting}>{tc('PUB_Submit')}</Button>
      </div>
    </form>
  );
}

function AlertListFields({ form, t }: { form: ReturnType<typeof useForm<RuleFormValues>>; t: (k: string) => string }) {
  const alertFields = useFieldArray({ control: form.control, name: 'alertList' });
  if (alertFields.fields.length === 0) return null;
  return (
    <div>
      {alertFields.fields.map((field, idx) => {
        const priority = form.watch(`alertList.${idx}.priority`);
        return (
          <div key={field.id} className="mb-4">
            <div className="text-sm font-medium mb-1">{priority ? t(RISK_LEVEL_MAP[priority as number] || '') + ' - Risk ' + t('screening_monitoring_0034') : t('screening_monitoring_0034')}</div>
            <FormField name={`alertList.${idx}.contactInfo`} label="" register={form.register(`alertList.${idx}.contactInfo`, { validate: (val: string) => { if (!val) return true; const emails = val.split(','); if (emails.length > 20) return t('screening_monitoring_0037'); const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/; return emails.every((e: string) => re.test(e.trim())) ? true : t('screening_monitoring_0036'); } })} placeholder={t('screening_monitoring_0033')} />
          </div>
        );
      })}
    </div>
  );
}
