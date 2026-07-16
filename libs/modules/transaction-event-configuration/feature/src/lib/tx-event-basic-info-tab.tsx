'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import type { NormalizationEvent } from '@myorg/modules/transaction-event-configuration/data-access';
import {
  EMPTY_DISPLAY,
  formatDate,
  formatDateTime,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  mappingMethodMessageKey,
  resolveEventStatusMeta,
  statusToneClass,
} from '@myorg/modules/transaction-event-configuration/util';

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
  onBack,
}: {
  detail: NormalizationEvent | null;
  loading?: boolean;
  bookId?: string;
  onBack: () => void;
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

  const statusMeta = resolveEventStatusMeta(detail?.status);

  const basicRows: { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: 'mappingRuleId',
      label: t('field.mappingRuleId'),
      value: (
        <CopyableEllipsisText value={mappingRuleId} copyLabel={t('copy')} />
      ),
    },
    {
      key: 'status',
      label: t('field.status'),
      value: statusMeta ? (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
            statusMeta.tone
          )}`}
        >
          {t(statusMeta.labelKey)}
        </span>
      ) : (
        EMPTY_DISPLAY
      ),
    },
    {
      key: 'sourceEventType',
      label: t('field.sourceEventType'),
      value: sourceEventKey ? t(sourceEventKey) : EMPTY_DISPLAY,
    },
    {
      key: 'effectiveDate',
      label: t('field.effectiveDate'),
      value: formatDate(detail?.effectiveDate),
    },
    {
      key: 'creator',
      label: t('field.creator'),
      value: detail?.createUser || EMPTY_DISPLAY,
    },
    {
      key: 'createTime',
      label: t('field.createdOn'),
      value: formatDateTime(detail?.createTime),
    },
  ];

  const fieldRows = React.useMemo<FieldMappingRow[]>(() => {
    return (detail?.mappings ?? []).map((item, index) => {
      const methodKey = mappingMethodMessageKey(item.mappingMethod);
      return {
        id: String(item.normalizationEventMappingId ?? index),
        targetField: fieldLabel(t, item.mappingField),
        mappingMethod: methodKey ? t(methodKey) : EMPTY_DISPLAY,
        sourceField: item.fieldDesc || fieldLabel(t, item.sourceField),
        description: item.remarks || item.fieldValue || EMPTY_DISPLAY,
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
    <div className="space-y-6 p-6">
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.basicInformation')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              {basicRows.map((row) => (
                <tr key={row.key}>
                  <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                    {row.label}
                  </td>
                  <td className="break-all border px-4 py-3">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.fieldMappings')}
        </div>
        <div className="p-4">
          <DataTable
            columns={fieldColumns}
            data={fieldRows}
            isLoading={loading}
            emptyMessage={t('empty')}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onBack}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
