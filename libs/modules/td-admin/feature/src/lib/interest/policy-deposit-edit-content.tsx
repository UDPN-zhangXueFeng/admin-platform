/** 存款策略编辑表单。 */
'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  useEditInterestPolicy,
  useInterestPolicyDetail,
  useSaveInterestPolicy,
} from '@myorg/modules/td-admin/data-access';
import type { DepositPolicyFormValues, SaveDetailsFormItem } from '@myorg/modules/td-admin/data-access';
import { INTEREST_RATE_PATTERN } from './interest.constants';
import { DepositTierRates } from './policy-deposit-tier-rates';
import { FIELD_HINT_CLASS, FIELD_LABEL_CLASS, PolicyFormSection, SignedRateInput } from './policy-form-parts';
import { toast } from '@myorg/shared/ui';

function buildInitialSaveDetails(t: (k: string) => string): SaveDetailsFormItem[] {
  return Array.from({ length: 3 }, () => ({
    interestRate: '',
    maxValue: '',
    minValue: '',
    type: t('interest_00118'), // add
  }));
}

export function DepositEditContent() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = Boolean(id);
  const interestRuleId = Number(id);

  const { data: existingDetail } = useInterestPolicyDetail(isEdit ? interestRuleId : 0);
  const [detailLoaded, setDetailLoaded] = useState(false);

  const saveMutation = useSaveInterestPolicy();
  const editMutation = useEditInterestPolicy();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DepositPolicyFormValues>({
    defaultValues: {
      interestPolicyName: '',
      accountType: 2,
      interestCalculationMethod: 1,
      annualInterestRate: '',
      selectType: t('interest_00118'),
      effectiveTime: '',
      day: t('interest_00123'),
      month: t('interest_00125'),
      calculateTimeDay: '',
      calculateTimeMonth: '',
      calculateDayMonth: 1,
      saveDetails: [],
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'saveDetails',
  });

  const interestCalculationMethod = useWatch({
    control: form.control,
    name: 'interestCalculationMethod',
  });

  // 初始化数据
  useEffect(() => {
    if (isEdit && existingDetail && !detailLoaded) {
      setDetailLoaded(true);
      const {
        interestPolicyName,
        accountType,
        annualInterestRate,
        effectiveTime,
        calculateTimeDay,
        calculateTimeMonth,
        interestCalculationMethod: method,
        saveDetails,
        calculateDayMonth,
      } = existingDetail;

      form.setValue('interestPolicyName', interestPolicyName);
      form.setValue('accountType', accountType ?? 2);
      form.setValue('interestCalculationMethod', method ?? 1);
      form.setValue('calculateTimeDay', calculateTimeDay);
      form.setValue('calculateTimeMonth', calculateTimeMonth);
      form.setValue('calculateDayMonth', calculateDayMonth ?? 1);

      if (effectiveTime) {
        form.setValue('effectiveTime', effectiveTime);
      }

      // 利率正负号回填（indexOf('-')）
      if (annualInterestRate) {
        const isNegative = annualInterestRate.indexOf('-') > -1;
        form.setValue('annualInterestRate', isNegative ? annualInterestRate.split('-')[1] : annualInterestRate);
        form.setValue('selectType', isNegative ? t('interest_00119') : t('interest_00118'));
      }

      if (method === 2 && saveDetails) {
        const items = saveDetails.map((el) => ({
          interestRate: el.interestRate.indexOf('-') > -1 ? el.interestRate.split('-')[1] : el.interestRate,
          type: el.interestRate.indexOf('-') > -1 ? t('interest_00119') : t('interest_00118'),
          maxValue: el.maxValue,
          minValue: el.minValue,
        }));
        form.setValue('saveDetails', items as SaveDetailsFormItem[]);
      }
    } else if (!isEdit && !detailLoaded) {
      setDetailLoaded(true);
      // 新建模式初始化 3 行空分段利率
      form.setValue('saveDetails', buildInitialSaveDetails(t));
    }
  }, [isEdit, existingDetail, detailLoaded, form, t]);

  // 切换计算方式时重置
  const handleMethodChange = (value: number) => {
    form.setValue('interestCalculationMethod', value);
    form.setValue('annualInterestRate', '');
    form.setValue('selectType', t('interest_00118'));
    form.setValue('effectiveTime', '');
    if (value === 1) {
      form.setValue('saveDetails', []);
    } else {
      form.setValue('saveDetails', buildInitialSaveDetails(t));
    }
  };

  const onSubmit = async (values: DepositPolicyFormValues) => {
    setSubmitting(true);
    try {
      const { day, month, effectiveTime, calculateTimeDay, calculateTimeMonth, saveDetails, annualInterestRate, selectType, interestCalculationMethod, ...rest } = values;

      const effectiveEpoch = effectiveTime ? Math.floor(new Date(effectiveTime).getTime() / 1000) : 0;
      const annualRate = interestCalculationMethod === 1
        ? (selectType === t('interest_00118') ? annualInterestRate : `-${annualInterestRate}`)
        : null;

      const params: Record<string, unknown> = {
        ...rest,
        interestType: 2,
        interestCalculationMethod,
        annualInterestRate: annualRate,
        effectiveTime: effectiveEpoch,
        calculateTimeDay,
        calculateTimeMonth,
      };

      if (interestCalculationMethod === 2 && saveDetails) {
        params.saveDetails = saveDetails.map((el) => ({
          interestRate: el.type === t('interest_00118') ? el.interestRate : `-${el.interestRate}`,
          maxValue: Number(el.maxValue),
          minValue: Number(el.minValue),
        }));
      }

      if (isEdit) {
        await editMutation.mutateAsync({ ...params, interestRuleId } as never);
      } else {
        await saveMutation.mutateAsync(params as never);
      }

      toast.success(tc('PUB_Success'));
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const isNameDisabled = isEdit && existingDetail && (existingDetail.status === 10 || existingDetail.status === 15);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white shadow p-10 pt-6">
      <h4 className="text-lg font-medium mb-6">
        {t('interest_0090').replace('****', isEdit ? tc('PUB_Edit') : tc('PUB_New'))}
      </h4>

      <PolicyFormSection title={t('interest_0021')} description={t('interest_0022')}>
        <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <FormField name="interestPolicyName" label={t('interest_0002')}
            register={form.register('interestPolicyName', { required: true })}
            disabled={isNameDisabled} maxLength={50} placeholder={t('interest_0050')} />
          <div>
            <label className={FIELD_LABEL_CLASS}>{t('interest_0005')}</label>
            <Select disabled defaultValue="2">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2">{t('interest_account_type_2')}</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <span className={FIELD_LABEL_CLASS}>{t('interest_0032')}</span>
            <div className="flex flex-wrap gap-6">
              {[1, 2].map((method) => (
                <label key={method} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="interestCalculationMethod"
                    checked={interestCalculationMethod === method} onChange={() => handleMethodChange(method)} />
                  <span>{t(`interest_method_${method}`)}</span>
                </label>
              ))}
            </div>
          </div>
          {interestCalculationMethod === 1 ? (
            <div>
              <SignedRateInput control={form.control} signName="selectType" rateName="annualInterestRate"
                label={t('interest_0006')} rateRegister={form.register('annualInterestRate', {
                  required: tc('PUB_Pleased').replace('****', t('interest_0006')),
                  pattern: { value: INTEREST_RATE_PATTERN, message: t('interest_0057') },
                })} />
              <div className={FIELD_HINT_CLASS}>{t('interest_0011')}</div>
            </div>
          ) : (
            <div className="md:col-span-2"><DepositTierRates form={form} fieldArray={fieldArray} /></div>
          )}
          <FormField name="effectiveTime" label={t('interest_0003')} type="date"
            register={form.register('effectiveTime', { required: true })} />
        </div>
      </PolicyFormSection>

      <PolicyFormSection title={t('interest_0023')} description={t('interest_0024')}>
        <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <div>
            <label className={FIELD_LABEL_CLASS}>{t('interest_0051')}</label>
            <Input disabled value={t('interest_00123')} />
          </div>
          <div>
            <FormField name="calculateTimeDay" label={t('interest_0012')} type="time"
              register={form.register('calculateTimeDay', { required: true })} />
            <div className={FIELD_HINT_CLASS}>{t('interest_0028')}</div>
          </div>
        </div>
      </PolicyFormSection>

      <PolicyFormSection title={t('interest_0025')} description={t('interest_0026')}>
        <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 [&_label]:whitespace-nowrap">
              <FormField name="calculateDayMonth" label={t('interest_0052')} type="number"
                register={form.register('calculateDayMonth', { required: true, min: 1, max: 28 })} />
            </div>
            <span className="flex h-10 items-center text-sm text-muted-foreground">{t('interest_00125')}</span>
          </div>
          <FormField name="calculateTimeMonth" label={t('interest_0098')} type="time"
            register={form.register('calculateTimeMonth', { required: true })} />
          <div className={`${FIELD_HINT_CLASS} md:col-span-2`}>{t('interest_0053')}</div>
        </div>
      </PolicyFormSection>

      <div className="flex justify-end gap-4 mt-10">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {tc('PUB_GoBack')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {tc('PUB_Submit')}
        </Button>
      </div>
    </form>
  );
}
