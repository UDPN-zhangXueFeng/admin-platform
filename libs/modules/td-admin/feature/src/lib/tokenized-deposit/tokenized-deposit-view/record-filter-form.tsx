/**
 * RecordFilterForm — Tab1 铸销记录筛选表单（源 form1 items）。
 * 源: tokenized-deposit-view-page.tsx 66-72, 190-216, 382-472
 */
'use client';

import * as React from 'react';
import type {
  Control,
  UseFormHandleSubmit,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { REVIEW_SUBMIT_STATE_KEY_PREFIX } from '@myorg/modules/td-admin/data-access';


/**
 * 审批提交状态文案 key 映射（对齐源 settingsStatus）。
 *
 * 源用 Record<number,string> 显式列出 1/2/4/5/6/7（跳过 3），value 为 i18n key。
 * 这里保留同集合（review_submit_state_ 前缀）。
 */
const REVIEW_SUBMIT_STATES = [1, 2, 4, 5, 6, 7] as const;

/** Tab1 筛选表单值（对齐源 form1 items）。 */
export interface RecordFilterFormValues {
  /** 交易 hash（源 name 'txHash'）。 */
  txHash: string;
  /** 类型（源 name 'type'，'1'=发行/'2'=销毁，空='all'）。 */
  type: string;
  /** 创建时间起（源 startCreateTime）。 */
  startCreateTime: string;
  /** 创建时间止（源 endCreateTime）。 */
  endCreateTime: string;
  /** 状态（源 name 'state'，1/2/4/5/6/7，空='all'）。 */
  state: string;
  /** 审核时间起（源 startReviewerTime）。 */
  startReviewerTime: string;
  /** 审核时间止（源 endReviewerTime）。 */
  endReviewerTime: string;
}

/** 空筛选默认值（源 EMPTY_FILTER，minting-melting-tab 复位与初始 query 使用）。 */
export const EMPTY_FILTER: RecordFilterFormValues = {
  txHash: '',
  type: 'all',
  startCreateTime: '',
  endCreateTime: '',
  state: 'all',
  startReviewerTime: '',
  endReviewerTime: '',
};

interface RecordFilterFormProps {
  control: Control<RecordFilterFormValues>;
  handleSubmit: UseFormHandleSubmit<RecordFilterFormValues>;
  onFilterSubmit: (values: RecordFilterFormValues) => void;
  onFilterReset: () => void;
  startCreateTime: string;
  endCreateTime: string;
  startReviewerTime: string;
  endReviewerTime: string;
}

export function RecordFilterForm({
  control,
  handleSubmit,
  onFilterSubmit,
  onFilterReset,
  startCreateTime,
  endCreateTime,
  startReviewerTime,
  endReviewerTime,
}: RecordFilterFormProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <form
      onSubmit={handleSubmit(onFilterSubmit)}
      className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <div>
        <label
          htmlFor="view-filter-txHash"
          className="mb-1.5 block text-sm font-medium"
        >
          {t('stablecoin_settings_002')}
        </label>
        <Input
          id="view-filter-txHash"
          {...control.register('txHash')}
          placeholder={t('stablecoin_settings_002')}
        />
      </div>

      <FormSelect
        name="type"
        control={control}
        label={t('PUB_Type')}
        options={[
          { value: 'all', label: t('PUB_All') },
          { value: '1', label: t('stablecoin_record_type_1') },
          { value: '2', label: t('stablecoin_record_type_2') },
        ]}
      />

      <FormSelect
        name="state"
        control={control}
        label={t('PUB_Status')}
        options={[
          { value: 'all', label: t('PUB_All') },
          ...REVIEW_SUBMIT_STATES.map((s) => ({
            value: String(s),
            label: t(`${REVIEW_SUBMIT_STATE_KEY_PREFIX}${s}`),
          })),
        ]}
      />

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          {t('PUB_CreateTime')}
        </span>
        <div className="flex items-center gap-2">
          <FormDatePicker
            name="startCreateTime"
            control={control}
            label=""
            max={endCreateTime || undefined}
          />
          <span className="text-muted-foreground">~</span>
          <FormDatePicker
            name="endCreateTime"
            control={control}
            label=""
            min={startCreateTime || undefined}
          />
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          {t('PUB_ReviewTime')}
        </span>
        <div className="flex items-center gap-2">
          <FormDatePicker
            name="startReviewerTime"
            control={control}
            label=""
            max={endReviewerTime || undefined}
          />
          <span className="text-muted-foreground">~</span>
          <FormDatePicker
            name="endReviewerTime"
            control={control}
            label=""
            min={startReviewerTime || undefined}
          />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit">{t('PUB_Query')}</Button>
        <Button type="button" variant="outline" onClick={onFilterReset}>
          {t('PUB_Reset')}
        </Button>
      </div>
    </form>
  );
}
