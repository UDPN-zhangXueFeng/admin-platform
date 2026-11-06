/**
 * 利率策略编辑表单的布局零件：区块容器、字段标签、带正负号的利率输入。
 */
'use client';

import * as React from 'react';
import type { Control, FieldValues, Path, UseFormRegisterReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { FormField, FormSelect } from '@myorg/shared/ui-forms';

/** 与 FormField / FormSelect 内置 label 同款样式，保证同一行字段顶部对齐。 */
export const FIELD_LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-foreground';

/** 字段下方说明文字。 */
export const FIELD_HINT_CLASS = 'mt-1.5 text-xs text-muted-foreground';

interface PolicyFormSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/** 左侧标题说明 + 右侧字段区的两栏区块，窄屏自动堆叠。 */
export function PolicyFormSection({ title, description, children }: PolicyFormSectionProps) {
  return (
    <section className="flex flex-col gap-4 border-b border-gray-200 py-8 last:border-b-0 xl:flex-row xl:gap-12">
      <div className="flex flex-col gap-1 xl:w-72 xl:shrink-0">
        <h5 className="font-bold">{title}</h5>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

interface SignedRateInputProps<T extends FieldValues> {
  control: Control<T>;
  signName: Path<T>;
  rateName: Path<T>;
  rateRegister: UseFormRegisterReturn;
  /** 不展示可见标签时（分段利率非首行）仍提供无障碍名称 */
  label: string;
  showLabel?: boolean;
}

/** 正负号 Select + 利率数值 Input + % 后缀，三者底部对齐。 */
export function SignedRateInput<T extends FieldValues>({
  control,
  signName,
  rateName,
  rateRegister,
  label,
  showLabel = true,
}: SignedRateInputProps<T>) {
  const t = useTranslations('modules.interest');

  return (
    <div>
      {showLabel && <span className={FIELD_LABEL_CLASS}>{label}</span>}
      <div className="flex items-center gap-2">
        <div className="w-20 shrink-0 [&_label]:hidden">
          <FormSelect
            name={signName}
            label=""
            control={control}
            options={[
              { label: '+', value: t('interest_00118') },
              { label: '-', value: t('interest_00119') },
            ]}
          />
        </div>
        <div className="min-w-0 flex-1 [&_label]:hidden">
          <FormField name={rateName} label="" aria-label={label} type="number" register={rateRegister} />
        </div>
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </div>
  );
}
