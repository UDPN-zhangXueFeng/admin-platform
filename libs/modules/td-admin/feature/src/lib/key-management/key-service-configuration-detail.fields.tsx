/**
 * Field and label definitions for the key-service configuration detail
 * page. Table columns live in key-service-configuration-detail.tables.tsx.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DetailField, DetailGrid } from '@myorg/shared/ui';
import type { KeyServiceDetail } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';

/** Semantic tone → tailwind badge classes (status tone map values). */
const TONE_CLASS: Record<string, string> = {
  success:
    'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing:
    'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning:
    'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Status tag with semantic tone classes (shared by both tabs). */
export function StatusBadge({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export const ALL_VALUE = 'all';
export const RECORDS_PAGE_SIZE = 10;

/** react-hook-form values for the Operation Records filter form. */
export interface RecordsFilterFormValues {
  operationType: string;
}

export const RECORDS_FILTER_DEFAULTS: RecordsFilterFormValues = {
  operationType: ALL_VALUE,
};

/**
 * i18n-backed label getters and filter options shared by the header, the
 * detail fields and the three tables.
 */
export function useKeyServiceConfigurationLabels() {
  const t = useTranslations('modules.key-management');

  const statusMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0018'),
      2: t('key_management_0019'),
      3: t('key_management_0020'),
      4: t('key_management_0021'),
    }),
    [t],
  );

  const parameterTypeMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0066'),
      5: t('key_management_0023'),
      10: t('key_management_0024'),
    }),
    [t],
  );

  const operationTypeMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0025'),
      2: t('key_management_0010'),
      3: t('key_management_0026'),
      4: t('key_management_0011'),
      5: t('key_management_0027'),
      6: t('key_management_0028'),
    }),
    [t],
  );

  const operationStatusMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0029'),
      3: t('key_management_0030'),
      5: t('key_management_0031'),
      10: t('key_management_0032'),
      15: t('key_management_0021'),
      20: t('key_management_0033'),
      30: t('key_management_0034'),
      35: t('key_management_0035'),
      40: t('key_management_0036'),
      45: t('key_management_0037'),
    }),
    [t],
  );

  // Upstream detail.tsx renders '--' for any falsy value (0/undefined) in
  // status/type columns; truthy unknown codes fall back to the raw number.
  const getStatusLabel = React.useCallback(
    (status?: number) =>
      status ? (statusMap[status] ?? String(status)) : '--',
    [statusMap],
  );

  const getParameterTypeLabel = React.useCallback(
    (type?: number) => {
      if (type === undefined || type === null) return '--';
      return (
        parameterTypeMap[type] ?? t('key_management_0064', { value: type })
      );
    },
    [parameterTypeMap, t],
  );

  const getOperationTypeLabel = React.useCallback(
    (type?: number) => (type ? (operationTypeMap[type] ?? String(type)) : '--'),
    [operationTypeMap],
  );

  const getOperationStatusLabel = React.useCallback(
    (status?: number) =>
      status ? (operationStatusMap[status] ?? String(status)) : '--',
    [operationStatusMap],
  );

  const operationTypeOptions = React.useMemo(
    () => [
      { label: t('PUB_All'), value: ALL_VALUE },
      ...Object.entries(operationTypeMap).map(([value, label]) => ({
        label,
        value,
      })),
    ],
    [operationTypeMap, t],
  );

  return {
    getStatusLabel,
    getParameterTypeLabel,
    getOperationTypeLabel,
    getOperationStatusLabel,
    operationTypeOptions,
  };
}

/**
 * Basic-information fields for the detail card.
 *
 * The service name and status are rendered once in the page header, so this
 * card only pairs the two wallet groups, gives the description the full row
 * (line breaks preserved) and pairs the create/update audit fields.
 */
export function KeyServiceBasicFields({
  detail,
}: {
  detail?: KeyServiceDetail;
}) {
  const t = useTranslations('modules.key-management');

  return (
    <>
      <DetailGrid>
        <DetailField
          label={t('key_management_0054')}
          value={detail?.hotWalletGroupId}
        />
        <DetailField
          label={t('key_management_0055')}
          value={detail?.coldWalletGroupId}
        />
        <DetailField
          label={t('key_management_0053')}
          value={
            detail?.description ? (
              <span className="whitespace-pre-line break-words">
                {detail.description}
              </span>
            ) : undefined
          }
          span="full"
        />
      </DetailGrid>

      {/* Audit fields paired as create-by/create-on and update-by/update-on. */}
      <DetailGrid className="mt-5 border-t border-border/60 pt-4">
        <DetailField
          label={t('key_management_0049')}
          value={detail?.createdBy}
          muted
        />
        <DetailField
          label={t('key_management_0050')}
          value={formatAdminTimestamp(detail?.createdOn)}
          muted
        />
        <DetailField
          label={t('key_management_0051')}
          value={detail?.updatedBy}
          muted
        />
        <DetailField
          label={t('key_management_0052')}
          value={formatAdminTimestamp(detail?.updatedOn)}
          muted
        />
      </DetailGrid>
    </>
  );
}
