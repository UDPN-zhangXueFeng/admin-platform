'use client';

import { useForm } from 'react-hook-form';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, DataTable } from '@myorg/shared/ui';
import {
  FormDateRangePicker,
  FormField,
  FormSelect,
} from '@myorg/shared/ui-forms';
import { QueryForm } from '../query-form';
import type {
  OperationFilterState,
  OperationRecordRow,
  OperationType,
} from '@myorg/modules/td-admin/data-access';

const ALL_VALUE = 'all';

const OPERATION_TYPE_OPTIONS: { value: OperationType; labelKey: string }[] = [
  { value: 'create', labelKey: 'operationRecords.create' },
  { value: 'update', labelKey: 'operationRecords.update' },
  { value: 'activate', labelKey: 'operationRecords.activate' },
  { value: 'deactivate', labelKey: 'operationRecords.deactivate' },
];

interface OperationFilterForm {
  operationType?: string;
  creatorName?: string;
  rangeFrom?: string;
  rangeTo?: string;
}

/** 已应用筛选 → 表单默认值（Tab 重新挂载时保持筛选回显）。 */
function toFormDefaults(filters: OperationFilterState): OperationFilterForm {
  const [startMs, endMs] = filters.creationDateRange ?? [];
  return {
    operationType: filters.operationType ?? ALL_VALUE,
    creatorName: filters.creatorName ?? '',
    rangeFrom: startMs ? format(new Date(startMs), 'yyyy-MM-dd') : '',
    rangeTo: endMs ? format(new Date(endMs), 'yyyy-MM-dd') : '',
  };
}

const EMPTY_FORM: OperationFilterForm = {
  operationType: ALL_VALUE,
  creatorName: '',
  rangeFrom: '',
  rangeTo: '',
};

/** `YYYY-MM-DD` → 当天起/止 epoch ms；非法日期返回 undefined。 */
function toDayMs(value: string | undefined, isEnd: boolean): number | undefined {
  if (!value) return undefined;
  const date = parseISO(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return (isEnd ? endOfDay(date) : startOfDay(date)).getTime();
}

export interface OperationRecordsContentProps {
  bookName: string;
  rows: OperationRecordRow[];
  columns: ColumnDef<OperationRecordRow>[];
  loading: boolean;
  error: boolean;
  total: number;
  pagination: { pageNum: number; pageSize: number };
  initialFilters: OperationFilterState;
  onApplyFilters: (filters: OperationFilterState) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

/**
 * Operation Records tab 内容（迁移自源 `OperationRecordsContent.tsx`）。
 *
 * 操作类型 / 创建人 / 创建时间范围筛选 + Query / Reset，服务端分页表格。
 */
export function OperationRecordsContent({
  bookName,
  rows,
  columns,
  loading,
  error,
  total,
  pagination,
  initialFilters,
  onApplyFilters,
  onResetFilters,
  onPageChange,
  onPageSizeChange,
  t,
}: OperationRecordsContentProps) {
  const { control, handleSubmit, register, reset } = useForm<OperationFilterForm>({
    defaultValues: toFormDefaults(initialFilters),
  });

  const onSubmit = (form: OperationFilterForm) => {
    const startMs = toDayMs(form.rangeFrom, false);
    const endMs = toDayMs(form.rangeTo, true);
    onApplyFilters({
      operationType:
        form.operationType && form.operationType !== ALL_VALUE
          ? (form.operationType as OperationType)
          : undefined,
      creatorName: form.creatorName?.trim() || undefined,
      creationDateRange:
        startMs !== undefined && endMs !== undefined ? [startMs, endMs] : null,
    });
  };

  const onReset = () => {
    reset(EMPTY_FORM);
    onResetFilters();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('operationRecords.description', { bookName })}
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <QueryForm
          fields={[
            <FormSelect
              key="operationType"
              name="operationType"
              control={control}
              label={t('operationRecords.operationType')}
              options={[
                { value: ALL_VALUE, label: t('filter.all') },
                ...OPERATION_TYPE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: t(option.labelKey),
                })),
              ]}
              placeholder={t('filter.all')}
            />,
            <FormField
              key="creatorName"
              name="creatorName"
              label={t('operationRecords.creatorName')}
              register={register('creatorName')}
              placeholder={t('operationRecords.creatorPlaceholder')}
              className="w-[220px]"
            />,
            <FormDateRangePicker
              key="range"
              startName="rangeFrom"
              endName="rangeTo"
              control={control}
              label={t('operationRecords.creationDate')}
              startPlaceholder={t('operationRecords.creationStartPlaceholder')}
              endPlaceholder={t('operationRecords.creationEndPlaceholder')}
            />,
          ]}
          onReset={onReset}
          queryType="submit"
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card>
        <div className="p-4">
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{t('common.loadFailed')}</p>}
          <DataTable
            columns={columns}
            data={rows}
            isLoading={loading}
            emptyMessage="--"
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange,
              onPageSizeChange,
              disabled: loading,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
