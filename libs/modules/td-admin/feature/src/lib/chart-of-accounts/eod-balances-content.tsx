'use client';

import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, DataTable } from '@myorg/shared/ui';
import { FormDateRangePicker, FormSelect } from '@myorg/shared/ui-forms';
import { QueryForm } from '../query-form';
import type {
  EodClearingStatus,
  EodStatementRow,
} from '@myorg/modules/td-admin/data-access';

/**
 * EOD Statements tab 内容（迁移自源 EodBalancesContent.tsx）。
 *
 * antd Form + DatePicker.RangePicker + Select → react-hook-form +
 * FormDateRangePicker + FormSelect（日期范围用单个 start → end range input）。
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
  t: (key: string) => string;
}

export function EodBalancesContent({
  rows,
  columns,
  description,
  onApplyFilters,
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <QueryForm
          fields={[
            <FormDateRangePicker
              key="range"
              startName="rangeFrom"
              endName="rangeTo"
              control={control}
              label={t('eod.eodDate')}
            />,
            <FormSelect
              key="clearingStatus"
              name="clearingStatus"
              control={control}
              label={t('eod.clearingStatus')}
              options={[
                { value: ALL_VALUE, label: t('filter.all') },
                ...CLEARING_STATUS_OPTIONS,
              ]}
              placeholder={t('filter.all')}
            />,
          ]}
          onReset={onReset}
          queryType="submit"
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card><div className="p-4">
        <DataTable columns={columns} data={rows} emptyMessage="--" />
      </div></Card>
    </div>
  );
}
