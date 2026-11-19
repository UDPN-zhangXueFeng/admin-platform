import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { JournalEntry } from '@myorg/modules/td-admin/data-access/lib/journal-entries-new';
import { useTranslations } from 'next-intl';
import { formatAdminTimestamp } from '../format-admin-time';
import { renderRowActions } from '../row-actions';
import { resolveTokenTypeMessageKey, resolveTxTypeMessageKey } from './journal-entries-new.constants';
import { formatListAmount } from './journal-entries-new-format';
import { JournalTxHashCell } from './journal-tx-hash-cell';

export function useJournalListColumns(
  viewDetails?: (record: JournalEntry) => void,
): ColumnDef<JournalEntry>[] {
  const t = useTranslations('modules.journal-entries-new');
  return useMemo<ColumnDef<JournalEntry>[]>(() => [
    ...([
      ['fromAddress', 'field.from'],
      ['toAddress', 'field.to'],
    ] as const).map(([accessorKey, label]): ColumnDef<JournalEntry> => ({
      accessorKey,
      header: t(label),
      cell: ({ row }) => <JournalTxHashCell value={row.original[accessorKey]} copyLabel={t('copy')} />,
    })),
    { accessorKey: 'tokenName', header: t('field.tokenName'), cell: ({ row }) => row.original.tokenName || '--' },
    {
      accessorKey: 'tokenType', header: t('field.tokenType'),
      cell: ({ row }) => {
        const key = resolveTokenTypeMessageKey(row.original.tokenType);
        return key ? t(key) : '--';
      },
    },
    { accessorKey: 'blockchain', header: t('field.blockchain'), cell: ({ row }) => row.original.blockchain || '--' },
    {
      accessorKey: 'txType', header: t('field.transactionType'),
      cell: ({ row }) => {
        const key = resolveTxTypeMessageKey(row.original.txType);
        return key ? t(key) : '--';
      },
    },
    {
      accessorKey: 'transactionAmount', header: t('field.transactionAmount'),
      cell: ({ row: { original } }) => formatListAmount(original.transactionAmount, original.currencyCode),
    },
    {
      accessorKey: 'transactionTime', header: t('field.transactionTime'),
      cell: ({ row }) => formatAdminTimestamp(row.original.transactionTime),
    },
    {
      accessorKey: 'txHash', header: t('field.transactionHash'),
      cell: ({ row }) => <JournalTxHashCell value={row.original.txHash} copyLabel={t('copy')} />,
    },
    {
      id: 'actions', header: t('field.actions'), enableSorting: false,
      meta: { overflow: 'none', stickyRight: true },
      cell: ({ row }) => viewDetails
        ? renderRowActions(row.original, { detail: { label: t('action.detail'), onClick: viewDetails } })
        : '--',
    },
  ], [t, viewDetails]);
}
