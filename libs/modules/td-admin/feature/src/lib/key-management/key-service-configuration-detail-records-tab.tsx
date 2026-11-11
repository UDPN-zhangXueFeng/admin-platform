/**
 * Operation Records tab for the key-service configuration detail page.
 *
 * The filter toolbar and the records table share one `DetailSection` block
 * so the tab reads as a single unit instead of two stacked cards. The query,
 * RHF wiring, pagination and retry behavior are unchanged from the original
 * implementation.
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { Alert, Button, DataTable, DetailSection } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { useKeyServiceOperationRecordsQuery } from '@myorg/modules/td-admin/data-access';
import {
  ALL_VALUE,
  RECORDS_FILTER_DEFAULTS,
  RECORDS_PAGE_SIZE,
  useKeyServiceConfigurationLabels,
  type RecordsFilterFormValues,
} from './key-service-configuration-detail.fields';
import {
  buildOperationRecordRows,
  useOperationRecordColumns,
} from './key-service-configuration-detail.tables';

export function KeyServiceOperationRecordsTab({
  keyServiceCode,
  keyServiceName,
}: {
  keyServiceCode?: string;
  keyServiceName?: string;
}) {
  const t = useTranslations('modules.key-management');
  const labels = useKeyServiceConfigurationLabels();

  const [recordsPage, setRecordsPage] = React.useState(1);
  const [recordsPageSize, setRecordsPageSize] =
    React.useState(RECORDS_PAGE_SIZE);

  const { watch, reset, control } = useForm<RecordsFilterFormValues>({
    defaultValues: RECORDS_FILTER_DEFAULTS,
  });

  const filters = watch();

  const recordsParams = React.useMemo(
    () => ({
      pageNum: recordsPage,
      pageSize: recordsPageSize,
      filters: {
        keyServiceCode: keyServiceCode ?? '',
        ...(filters.operationType && filters.operationType !== ALL_VALUE
          ? { operationType: Number(filters.operationType) }
          : {}),
      },
    }),
    [filters.operationType, recordsPage, recordsPageSize, keyServiceCode],
  );

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError: recordsError,
    error: recordsErrorValue,
    refetch: refetchRecords,
  } = useKeyServiceOperationRecordsQuery(recordsParams);

  // Upstream handleOperationTypeChange resets to page 1 on filter change.
  React.useEffect(() => {
    setRecordsPage(1);
  }, [filters.operationType]);

  // Backend total may arrive as a string — upstream coerces Number(...) || 0.
  const recordsTotal = Number(recordsData?.page?.total) || 0;

  const handleRecordsReset = () => {
    reset(RECORDS_FILTER_DEFAULTS);
    setRecordsPage(1);
  };

  const recordsColumns = useOperationRecordColumns(
    labels.getOperationTypeLabel,
    labels.getOperationStatusLabel,
  );
  const recordsRows = buildOperationRecordRows(recordsData?.rows);

  return (
    <DetailSection title={t('key_management_0058')} contentPadding="none">
      {/* Toolbar — filter form inside the same block as the table. */}
      <div className="border-b border-border/60 px-4 pb-4 sm:px-6 sm:pb-6">
        <p className="mb-4 text-sm text-muted-foreground">
          {t('key_management_0047', {
            name: keyServiceName ? `(${keyServiceName})` : '--',
          })}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormSelect
            name="operationType"
            control={control}
            label={t('key_management_0048')}
            options={labels.operationTypeOptions}
            placeholder={t('PUB_All')}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={() => refetchRecords()}>{t('PUB_Query')}</Button>
            <Button variant="outline" onClick={handleRecordsReset}>
              {t('PUB_Reset')}
            </Button>
          </div>
        </div>
      </div>

      {/* Records body — error banner + paginated table. */}
      <div className="space-y-4 px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
        {recordsError ? (
          <Alert variant="destructive">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 break-words">
                {recordsErrorValue?.message || t('key_management_0061')}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchRecords()}
              >
                {t('key_management_retry')}
              </Button>
            </div>
          </Alert>
        ) : null}
        <DataTable
          columns={recordsColumns}
          data={recordsRows}
          isLoading={recordsLoading}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page: recordsPage,
            pageSize: recordsPageSize,
            total: recordsTotal,
            onPageChange: setRecordsPage,
            onPageSizeChange: (size) => {
              setRecordsPage(1);
              setRecordsPageSize(size);
            },
          }}
        />
      </div>
    </DetailSection>
  );
}
