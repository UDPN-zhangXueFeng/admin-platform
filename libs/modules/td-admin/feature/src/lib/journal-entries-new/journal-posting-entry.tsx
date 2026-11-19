import type { ColumnDef } from '@tanstack/react-table';
import { useTokenTypesQuery, type JournalDetailData, type JournalNormalizationRow } from '@myorg/modules/td-admin/data-access';
import { Card, DataTable } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { formatAdminTimestamp } from '../format-admin-time';
import { formatPostingAmount } from './journal-entries-new-format';

interface PostingEntryRow extends JournalNormalizationRow {
  id: string;
}

export function JournalPostingEntry({ detail }: { detail?: JournalDetailData | null }) {
  const t = useTranslations('modules.journal-entries-new');
  const { data: tokenTypes } = useTokenTypesQuery();
  const normalized = detail?.normalizedJson;
  const rows = useMemo<PostingEntryRow[]>(() => (detail?.normalizationData ?? []).map((row, index) => ({
    ...row,
    id: [row.sourceField, row.mappingField, row.fieldValue, row.mappingMethod, index].join('|'),
  })), [detail?.normalizationData]);

  const columns = useMemo<ColumnDef<PostingEntryRow>[]>(() => [
    { accessorKey: 'mappingField', header: t('detail.columnName'), cell: ({ row }) => row.original.mappingField || '--' },
    {
      accessorKey: 'fieldValue', header: t('detail.value'),
      cell: ({ row: { original: { fieldValue, mappingField } } }) => {
        const raw = (mappingField ? normalized?.[mappingField] : undefined) ?? fieldValue;
        const value = raw == null || raw === '' ? '--' : String(raw);
        if (mappingField === 'Status') return t('detail.success');
        if (mappingField === 'Token Type') {
          return tokenTypes?.find(({ tokenTypeId }) => String(tokenTypeId) === value)?.tokenTypeName || value;
        }
        if (mappingField === 'Transaction Amount') return formatPostingAmount(value);
        if (mappingField?.includes('Date') && value !== '--' && Number.isFinite(Number(value))) {
          return formatAdminTimestamp(value);
        }
        return value;
      },
    },
    {
      id: 'logicType', header: t('detail.logicType'),
      cell: ({ row: { original: { fieldValue, mappingField, mappingMethod, sourceField } } }) => {
        const accountField = mappingField?.trim().toUpperCase();
        if (accountField === 'DR_ACCT' || accountField === 'CR_ACCT') return t('detail.postingEngineLogic');
        if (mappingMethod === 3) return t('detail.generatedLogic');
        if (mappingMethod === 2) return fieldValue == null || fieldValue === '' ? '--' : String(fieldValue);
        if (mappingMethod !== 1) return '--';
        if (mappingField === 'Finality Date') return t('detail.finalityDateLogic');
        if (mappingField === 'Value Date') return t('detail.valueDateLogic');
        return t('detail.directLogic', { field: mappingField || sourceField || t('detail.unnamedField') });
      },
    },
  ], [normalized, t, tokenTypes]);

  return (
    <Card>
      <div className="border-b px-6 py-4 text-base font-semibold">{t('detail.postingEntry')}</div>
      <div className="p-6"><DataTable columns={columns} data={rows} emptyMessage={t('empty')} /></div>
    </Card>
  );
}
