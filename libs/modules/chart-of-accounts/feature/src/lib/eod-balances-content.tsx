'use client';

import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import type {
  EodClearingStatus,
  EodStatementRow,
} from '@myorg/modules/chart-of-accounts/data-access';

/**
 * EOD Statements tab 内容（迁移自源 EodBalancesContent.tsx）。
 *
 * antd Form + DatePicker.RangePicker + Select → react-hook-form +
 * FormDatePicker×2 + FormSelect（日期范围用两个 date input）。
 * 筛选在 submit 时转换为 `[startMs, endMs]` + clearingStatus 交给上层。
 */
const ALL_VALUE = 'all';

const CLEARING_STATUS_OPTIONS = [
  { label: 'Settled', value: 'settled' },
  { label: 'Suspensed', value: 'suspensed' },
  { label: 'Adjusted', value: 'adjusted' },
  { label: 'Pending', value: 'pending' },
] as const;

interface EodFilterForm {
  rangeFrom?: string;
  rangeTo?: string;
  clearingStatus?: string;
}

export interface EodBalancesContentProps {
  rows: EodStatementRow[];
  columns: ColumnDef<EodStatementRow>[];
  description: string;
  onApplyFilters: (
    range: [number, number] | null,
    clearingStatus?: EodClearingStatus
  ) => void;
  onBack: () => void;
  t: (key: string) => string;
}

export function EodBalancesContent({
  rows,
  columns,
  description,
  onApplyFilters,
  onBack,
  t,
}: EodBalancesContentProps) {
  const { control, handleSubmit, reset } = useForm<EodFilterForm>({
    defaultValues: { rangeFrom: '', rangeTo: '', clearingStatus: ALL_VALUE },
  });

  const onSubmit = (form: EodFilterForm) => {
    const from = form.rangeFrom ? new Date(form.rangeFrom).getTime() : undefined;
    const to = form.rangeTo ? new Date(form.rangeTo).getTime() : undefined;
    const range = from && to ? ([from, to] as [number, number]) : null;
    const clearing =
      form.clearingStatus && form.clearingStatus !== ALL_VALUE
        ? (form.clearingStatus as EodClearingStatus)
        : undefined;
    onApplyFilters(range, clearing);
  };

  const onReset = () => {
    reset({ rangeFrom: '', rangeTo: '', clearingStatus: ALL_VALUE });
    onApplyFilters(null, undefined);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-4">
          <FormDatePicker name="rangeFrom" control={control} label={t('eod.rangeFrom')} />
          <FormDatePicker name="rangeTo" control={control} label={t('eod.rangeTo')} />
          <FormSelect
            name="clearingStatus"
            control={control}
            label={t('eod.clearingStatus')}
            options={[
              { value: ALL_VALUE, label: t('filter.all') },
              ...CLEARING_STATUS_OPTIONS,
            ]}
            placeholder={t('filter.all')}
          />
          <div className="flex gap-2 pb-2">
            <Button type="submit">{t('filter.query')}</Button>
            <Button type="button" variant="outline" onClick={onReset}>
              {t('filter.reset')}
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4">
          <DataTable columns={columns} data={rows} emptyMessage="--" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onBack}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
