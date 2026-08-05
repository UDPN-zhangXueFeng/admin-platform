/**
 * 透支策略编辑表单内容（简化版，无分段利率、无计算方式切换）。
 *
 * interestType=1，interestCalculationMethod 固定为 1。
 */
'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
} from '@myorg/modules/interest/data-access';
import type { OverdraftPolicyFormValues } from '@myorg/modules/interest/data-access';
import { INTEREST_RATE_PATTERN } from '@myorg/modules/interest/util';
import { toast } from '@myorg/shared/ui';

export function OverdraftEditContent() {
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

  const form = useForm<OverdraftPolicyFormValues>({
    defaultValues: {
      interestPolicyName: '',
      accountType: 1,
      annualInterestRate: '',
      effectiveTime: '',
      day: t('interest_00123'),
      month: t('interest_00124'),
      calculateTimeDay: '',
      calculateTimeMonth: '',
    },
  });

  useEffect(() => {
    if (isEdit && existingDetail && !detailLoaded) {
      setDetailLoaded(true);
      const {
        interestPolicyName,
        annualInterestRate,
        effectiveTime,
        calculateTimeDay,
        calculateTimeMonth,
      } = existingDetail;

      form.setValue('interestPolicyName', interestPolicyName);
      form.setValue('annualInterestRate', annualInterestRate);
      form.setValue('calculateTimeDay', calculateTimeDay);
      form.setValue('calculateTimeMonth', calculateTimeMonth);
      if (effectiveTime) form.setValue('effectiveTime', effectiveTime);
    }
  }, [isEdit, existingDetail, detailLoaded, form]);

  const onSubmit = async (values: OverdraftPolicyFormValues) => {
    setSubmitting(true);
    try {
      const { day, month, effectiveTime, calculateTimeDay, calculateTimeMonth, ...rest } = values;
      const params = {
        ...rest,
        interestCalculationMethod: 1,
        interestType: 1,
        effectiveTime: effectiveTime ? Math.floor(new Date(effectiveTime).getTime() / 1000) : 0,
        calculateTimeDay,
        calculateTimeMonth,
      };

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
        {t('interest_0020').replace('****', isEdit ? tc('PUB_Edit') : tc('PUB_New'))}
      </h4>

      {/* 区块 1：策略配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[23%] flex flex-col">
          <span className="font-bold">
            {t('interest_0021').replace(t('interest_00134'), t('interest_00133'))}
          </span>
          <span className="text-sm text-muted-foreground">{t('interest_00135')}</span>
        </div>
        <div className="w-[73%]">
          <div className="flex justify-between">
            <div className="w-[70%]">
              <FormField
                name="interestPolicyName"
                label={t('interest_0027')}
                register={form.register('interestPolicyName', { required: true })}
                disabled={isNameDisabled}
                maxLength={50}
                placeholder={t('interest_0050')}
              />
            </div>
            <div className="w-[25%]">
              <label className="text-sm font-medium">{t('interest_0005')}</label>
              <Select disabled defaultValue="1">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('interest_account_type_1')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="w-[70%] flex justify-between mt-4">
            <div className="w-[60%]">
              <FormField
                name="annualInterestRate"
                label={t('interest_0006')}
                type="number"
                register={form.register('annualInterestRate', {
                  required: tc('PUB_Pleased').replace('****', t('interest_0006')),
                  pattern: { value: INTEREST_RATE_PATTERN, message: t('interest_0057') },
                })}
              />
              <div className="text-xs text-muted-foreground -mt-4">{t('interest_0011')}</div>
            </div>
            <div className="w-[35%]">
              <FormField
                name="effectiveTime"
                label={t('interest_0003')}
                type="date"
                register={form.register('effectiveTime', { required: true })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 区块 2：日计息配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[23%] flex flex-col">
          <span className="font-bold">
            {t('interest_0023').replace(t('interest_00134'), t('interest_00133'))}
          </span>
          <span className="text-sm text-muted-foreground">{t('interest_0024')}</span>
        </div>
        <div className="w-[73%]">
          <div className="flex gap-4">
            <div className="w-24">
              <label className="text-sm">{t('interest_0051')}</label>
              <Input disabled value={t('interest_00123')} />
            </div>
            <div className="flex-1 max-w-xs">
              <FormField
                name="calculateTimeDay"
                label={t('interest_0012')}
                type="time"
                register={form.register('calculateTimeDay', { required: true })}
              />
              <div className="text-xs text-muted-foreground -mt-4">{t('interest_00136')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 区块 3：月计息应用配置 */}
      <div className="flex justify-between py-6 mb-6 border-0 border-b border-solid border-gray-200">
        <div className="w-[23%] flex flex-col">
          <span className="font-bold">
            {t('interest_0025').replace(t('interest_00134'), t('interest_00133'))}
          </span>
          <span className="text-sm text-muted-foreground">{t('interest_0026')}</span>
        </div>
        <div className="w-[73%]">
          <div className="flex gap-4">
            <div className="w-24">
              <label className="text-sm">{t('interest_0051')}</label>
              <Input disabled value={t('interest_00124')} />
            </div>
            <div className="flex-1 max-w-xs">
              <FormField
                name="calculateTimeMonth"
                label={t('interest_0014')}
                type="time"
                register={form.register('calculateTimeMonth', { required: true })}
              />
              <div className="text-xs text-muted-foreground -mt-4">{t('interest_00136')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 提交 */}
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
