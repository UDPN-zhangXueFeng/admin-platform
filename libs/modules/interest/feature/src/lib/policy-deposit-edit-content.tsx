/**
 * 存款策略编辑表单内容（最复杂表单，829 行源码）。
 *
 * 三区块：① 策略配置（双计算方式 + 分段利率 Form.List + 生效日期）
 *         ② 日计息配置（TimePicker）
 *         ③ 月计息应用配置（Day Select + TimePicker）
 */
'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';

import { Button, Input, Select } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';

import {
  useEditInterestPolicy,
  useInterestPolicyDetail,
  useSaveInterestPolicy,
} from '@myorg/modules/interest/data-access';
import type { DepositPolicyFormValues, SaveDetailsFormItem } from '@myorg/modules/interest/data-access';
import {
  INTEREST_RATE_PATTERN,
  MAX_SAVE_DETAILS_ROWS,
} from '@myorg/modules/interest/util';
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'saveDetails',
  });

  const interestCalculationMethod = useWatch({
    control: form.control,
    name: 'interestCalculationMethod',
  });

  const currentSaveDetails = useWatch({ control: form.control, name: 'saveDetails' });

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white shadow p-10 pt-4">
      <h4 className="text-lg font-medium mb-6">
        {t('interest_0090').replace('****', isEdit ? tc('PUB_Edit') : tc('PUB_New'))}
      </h4>

      {/* 区块 1：策略配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[20%] flex flex-col">
          <span className="font-bold">{t('interest_0021')}</span>
          <span className="text-sm text-muted-foreground">{t('interest_0022')}</span>
        </div>
        <div className="w-[78%]">
          <div className="flex w-[60%] gap-10">
            <FormField
              name="interestPolicyName"
              label={t('interest_0002')}
              control={form.control}
              rules={{ required: true }}
              disabled={isNameDisabled}
              maxLength={50}
              placeholder={t('interest_0050')}
            />
            <div className="w-[35%]">
              <label className="text-sm font-medium">{t('interest_0005')}</label>
              <Select disabled defaultValue="2" options={[{ label: t('interest_account_type_2'), value: '2' }]} />
            </div>
          </div>

          <div className="flex justify-between mt-4">
            <div className="w-[60%]">
              {/* 计算方式 Radio */}
              <div className="mb-4">
                <label className="text-sm font-medium">{t('interest_0032')}</label>
                <div className="flex gap-4 mt-1">
                  {[1, 2].map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="interestCalculationMethod"
                        checked={interestCalculationMethod === method}
                        onChange={() => handleMethodChange(method)}
                      />
                      <span>{t(`interest_method_${method}`)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {interestCalculationMethod === 1 ? (
                /* 全额模式 */
                <div className="flex justify-between">
                  <div className="w-[60%]">
                    <div className="flex items-start gap-2">
                      <div className="w-16">
                        <FormSelect
                          name="selectType"
                          label=""
                          control={form.control}
                          options={[
                            { label: '+', value: t('interest_00118') },
                            { label: '-', value: t('interest_00119') },
                          ]}
                        />
                      </div>
                      <div className="flex-1">
                        <FormField
                          name="annualInterestRate"
                          label={t('interest_0006')}
                          control={form.control}
                          type="number"
                          rules={{
                            required: tc('PUB_Pleased').replace('****', t('interest_0006')),
                            pattern: {
                              value: INTEREST_RATE_PATTERN,
                              message: t('interest_0057'),
                            },
                          }}
                        />
                      </div>
                      <span className="mt-7">%</span>
                    </div>
                    <div className="text-xs text-muted-foreground -mt-4">{t('interest_0011')}</div>
                  </div>
                  <div className="w-[35%]">
                    <FormField
                      name="effectiveTime"
                      label={t('interest_0003')}
                      control={form.control}
                      type="date"
                      rules={{ required: true }}
                    />
                  </div>
                </div>
              ) : (
                /* 分段模式 */
                <>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex w-full mb-4 items-center gap-2">
                      <div className="w-[20%]">
                        <FormField
                          name={`saveDetails.${index}.minValue`}
                          label={index === 0 ? t('interest_0033') : ''}
                          control={form.control}
                          type="number"
                          rules={{
                            required: tc('PUB_Pleased').replace('****', t('interest_0033')),
                            validate: (value, formValues) => {
                              const current = formValues.saveDetails?.[index];
                              const previous = formValues.saveDetails?.[index - 1];
                              if (current?.maxValue && Number(value) >= Number(current.maxValue))
                                return t('interest_00120');
                              if (previous && Number(value) < Number(previous.maxValue))
                                return t('interest_00121');
                              return true;
                            },
                          }}
                        />
                      </div>
                      <span className="pt-5">-</span>
                      <div className="w-[20%]">
                        <FormField
                          name={`saveDetails.${index}.maxValue`}
                          label={index === 0 ? ' ' : ''}
                          control={form.control}
                          type="number"
                          rules={{
                            required: tc('PUB_Pleased').replace('****', t('interest_0033')),
                            validate: (value, formValues) => {
                              const current = formValues.saveDetails?.[index];
                              if (current && Number(value) <= Number(current.minValue))
                                return t('interest_00122');
                              return true;
                            },
                          }}
                        />
                      </div>
                      <div className="flex items-start gap-1 flex-1">
                        <div className="w-14">
                          <FormSelect
                            name={`saveDetails.${index}.type`}
                            label=""
                            control={form.control}
                            options={[
                              { label: '+', value: t('interest_00118') },
                              { label: '-', value: t('interest_00119') },
                            ]}
                          />
                        </div>
                        <div className="flex-1">
                          <FormField
                            name={`saveDetails.${index}.interestRate`}
                            label={t('interest_0006')}
                            control={form.control}
                            type="number"
                            rules={{
                              required: tc('PUB_Pleased').replace('****', t('interest_0006')),
                              pattern: {
                                value: INTEREST_RATE_PATTERN,
                                message: t('interest_0057'),
                              },
                            }}
                          />
                        </div>
                        <span className="mt-7">%</span>
                      </div>
                      {currentSaveDetails && currentSaveDetails.length > 1 && currentSaveDetails.length === index + 1 && (
                        <button type="button" className="text-red-500 pt-6" onClick={() => remove(index)}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {(!currentSaveDetails || currentSaveDetails.length < MAX_SAVE_DETAILS_ROWS) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mb-8"
                      onClick={() =>
                        append({ interestRate: '', maxValue: '', minValue: '', type: t('interest_00118') })
                      }
                    >
                      {tc('PUB_Add')}
                    </Button>
                  )}
                  <div className="w-[35%]">
                    <FormField
                      name="effectiveTime"
                      label={t('interest_0003')}
                      control={form.control}
                      type="date"
                      rules={{ required: true }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 区块 2：日计息配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[20%] flex flex-col">
          <span className="font-bold">{t('interest_0023')}</span>
          <span className="text-sm text-muted-foreground">{t('interest_0024')}</span>
        </div>
        <div className="w-[78%]">
          <div className="flex gap-4">
            <div className="w-24">
              <label className="text-sm">{t('interest_0051')}</label>
              <Input disabled value={t('interest_00123')} />
            </div>
            <div className="flex-1 max-w-xs">
              <FormField
                name="calculateTimeDay"
                label={t('interest_0012')}
                control={form.control}
                type="time"
                rules={{ required: true }}
              />
              <div className="text-xs text-muted-foreground -mt-4">{t('interest_0028')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 区块 3：月计息应用配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[20%] flex flex-col">
          <span className="font-bold">{t('interest_0025')}</span>
          <span className="text-sm text-muted-foreground">{t('interest_0026')}</span>
        </div>
        <div className="w-[78%]">
          <div className="flex gap-4">
            <div className="w-24">
              <FormField
                name="calculateDayMonth"
                label={t('interest_0052')}
                control={form.control}
                type="number"
                rules={{ required: true, min: 1, max: 28 }}
              />
            </div>
            <div className="w-20">
              <label className="text-sm">&nbsp;</label>
              <Input disabled value={t('interest_00125')} />
            </div>
            <div className="flex-1 max-w-xs">
              <FormField
                name="calculateTimeMonth"
                label={t('interest_0098')}
                control={form.control}
                type="time"
                rules={{ required: true }}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">{t('interest_0053')}</div>
        </div>
      </div>

      {/* 提交按钮 */}
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
