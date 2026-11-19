'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  CopyableEllipsisText,
  DataTable,
  DetailField,
  DetailGrid,
  DetailSection,
} from '@myorg/shared/ui';
import type { NormalizationEvent } from '@myorg/modules/td-admin/data-access';
import {
  EMPTY_DISPLAY,
  formatDate,
  formatDateTime,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  mappingMethodMessageKey,
  resolveEventStatusMeta,
  statusToneClass,
} from '.';

/**
 * 字段 → 模块 i18n key（迁移自源 BasicInformationTab FIELD_LABEL_KEY_MAP）。
 * 未知字段回退展示原始字段名。
 */
const FIELD_LABEL_KEY: Record<string, string> = {
  UniversalTransactionIdentifier: 'field.utIdentifier',
  UserUniversalIdentifier: 'field.userIdentifier',
  TokenName: 'field.tokenName',
  TransactionDate: 'field.transactionDate',
  ValueDate: 'field.valueDate',
  FinalityDate: 'field.finalityDate',
  OrganizationCode: 'field.organizationCode',
  TokenType: 'field.tokenType',
  Blockchain: 'field.blockchain',
  From: 'field.from',
  To: 'field.to',
  TransactionAmount: 'field.transactionAmount',
  TransactionHash: 'field.transactionHash',
  TransactionTime: 'field.transactionTime',
  Status: 'field.status',
};

interface FieldMappingRow {
  id: string;
  targetField: string;
  mappingMethod: string;
  sourceField: string;
  description: string;
}

function fieldLabel(t: (key: string) => string, field?: string): string {
  if (!field) return EMPTY_DISPLAY;
  const key = FIELD_LABEL_KEY[field];
  return key ? t(key) : field;
}

/**
 * BasicInformation tab — 迁移自 td-manage BasicInformationTab.tsx。
 * 规则元信息键值表（mappingRuleId / status / sourceEventType / effectiveDate /
 * creator / createTime）+ 字段映射明细表（targetField / mappingMethod / sourceField / description）。
 */
export function TxEventBasicInfoTab({
  detail,
  loading,
  bookId,
}: {
  detail: NormalizationEvent | null;
  loading?: boolean;
  bookId?: string;
}) {
  const t = useTranslations('modules.transaction-event-configuration');

  const mappingRuleId = detail
    ? detail.eventCode ||
      detail.versionId ||
      (detail.normalizationEventId
        ? String(detail.normalizationEventId)
        : EMPTY_DISPLAY)
    : EMPTY_DISPLAY;

  const sourceEventKey = (() => {
    const se = getSourceEventTypeByEventType(detail?.eventType);
    return getSourceEventTypeMessageKey(se, bookId);
  })();

  const statusMeta = detail?.status === 30 ? null : resolveEventStatusMeta(detail?.status);
  const statusBadge = statusMeta ? (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
        statusMeta.tone
      )}`}
    >
      {t(statusMeta.labelKey)}
    </span>
  ) : undefined;

  const fieldRows = React.useMemo<FieldMappingRow[]>(() => {
    return (detail?.mappings ?? []).map((item, index) => {
      const methodKey = mappingMethodMessageKey(item.mappingType || item.mappingMethod);
      return {
        id: String(item.normalizationEventMappingId ?? index),
        targetField: fieldLabel(t, item.targetField || item.mappingField),
        mappingMethod: methodKey ? t(methodKey) : EMPTY_DISPLAY,
        sourceField: item.fieldDesc || fieldLabel(t, item.sourceField),
        description: item.description || item.remarks || item.fieldValue || EMPTY_DISPLAY,
      };
    });
  }, [detail?.mappings, t]);

  const fieldColumns = React.useMemo<ColumnDef<FieldMappingRow>[]>(
    () => [
      { accessorKey: 'targetField', header: t('field.targetField') },
      { accessorKey: 'mappingMethod', header: t('field.mappingMethod') },
      { accessorKey: 'sourceField', header: t('field.sourceField') },
      { accessorKey: 'description', header: t('field.description') },
    ],
    [t]
  );

  return (
    <div className="space-y-4">
      <DetailSection
        title={t('detail.basicInformation')}
        actions={statusBadge}
        loading={loading}
        skeleton="fields"
      >
        <DetailGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <DetailField
            span="full"
            label={t('field.mappingRuleId')}
            value={
              detail ? (
                <CopyableEllipsisText
                  value={mappingRuleId}
                  copyLabel={t('copy')}
                  maxWidth={480}
                />
              ) : undefined
            }
          />
          <DetailField
            label={t('field.sourceEventType')}
            value={sourceEventKey ? t(sourceEventKey) : undefined}
          />
          <DetailField
            label={t('field.effectiveDate')}
            value={formatDate(detail?.effectiveDate)}
          />
          <DetailField
            label={t('field.creator')}
            value={detail?.createUser || detail?.createUserName}
          />
          <DetailField
            label={t('field.createdOn')}
            value={formatDateTime(detail?.createTime)}
          />
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title={t('detail.fieldMappings')}
        loading={loading}
        skeleton="table"
      >
        <DataTable
          columns={fieldColumns}
          data={fieldRows}
          isLoading={loading}
          emptyMessage={t('empty')}
        />
      </DetailSection>
    </div>
  );
}
