'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import type {
  TrialBalanceActivityRow,
  TrialBalanceRow,
} from '@myorg/modules/td-admin/data-access';

/** 试算平衡列定义（迁移自源 `trialBalanceColumns`）。 */
export interface TrialBalanceColumnsOptions {
  t: (key: string) => string;
  onOpenActivity: (record: TrialBalanceRow) => void;
}

/** 小计行整行加粗（源 `isSubtotal` 渲染分支）。 */
function subtotalText(isSubtotal: boolean | undefined, value: string) {
  return isSubtotal ? <span className="font-semibold">{value}</span> : value;
}

export function buildTrialBalanceColumns({
  t,
  onOpenActivity,
}: TrialBalanceColumnsOptions): ColumnDef<TrialBalanceRow>[] {
  return [
    {
      accessorKey: 'accountLabel',
      header: t('trialBalance.accountName'),
      size: 260,
      cell: ({ row }) => {
        if (row.original.isSubtotal) {
          return <span className="font-semibold">{row.original.accountLabel}</span>;
        }
        return (
          <span
            className="block whitespace-normal break-words"
            style={{ paddingLeft: row.original.depth * 28 }}
          >
            {row.original.accountLabel}
          </span>
        );
      },
    },
    {
      accessorKey: 'openingSide',
      header: t('trialBalance.drCr'),
      size: 90,
      cell: ({ row }) => subtotalText(row.original.isSubtotal, row.original.openingSide),
    },
    {
      accessorKey: 'opening',
      header: t('trialBalance.opening'),
      size: 170,
      cell: ({ row }) => subtotalText(row.original.isSubtotal, row.original.opening),
    },
    {
      accessorKey: 'debit',
      header: t('trialBalance.debit'),
      size: 170,
      cell: ({ row }) => subtotalText(row.original.isSubtotal, row.original.debit),
    },
    {
      accessorKey: 'credit',
      header: t('trialBalance.credit'),
      size: 170,
      cell: ({ row }) => subtotalText(row.original.isSubtotal, row.original.credit),
    },
    {
      accessorKey: 'activitySide',
      header: t('trialBalance.drCr'),
      size: 90,
      cell: ({ row }) =>
        subtotalText(row.original.isSubtotal, row.original.activitySide),
    },
    {
      accessorKey: 'closing',
      header: t('trialBalance.closing'),
      size: 170,
      cell: ({ row }) => subtotalText(row.original.isSubtotal, row.original.closing),
    },
    {
      id: 'activity',
      header: '',
      size: 130,
      cell: ({ row }) =>
        row.original.isSubtotal ? null : (
          <Button
            type="button"
            variant="ghost"
            className={cn('h-auto px-0 text-primary hover:bg-transparent')}
            onClick={() => onOpenActivity(row.original)}
          >
            {t('trialBalance.activityLink')}
          </Button>
        ),
    },
  ];
}

/** 科目活动明细列定义（迁移自源 `trialBalanceActivityColumns`）。 */
export interface TrialBalanceActivityColumnsOptions {
  t: (key: string) => string;
}

export function buildTrialBalanceActivityColumns({
  t,
}: TrialBalanceActivityColumnsOptions): ColumnDef<TrialBalanceActivityRow>[] {
  return [
    { accessorKey: 'postingDate', header: t('trialBalance.postingDate'), size: 100 },
    {
      accessorKey: 'transactionId',
      header: t('trialBalance.transactionId'),
      size: 145,
    },
    {
      id: 'eventType',
      header: t('trialBalance.transactionType'),
      size: 120,
      cell: ({ row }) => {
        const { eventTypeName, eventTypeCode, eventTypeRaw } = row.original;
        if (eventTypeName) return eventTypeName;
        if (eventTypeCode) return t(`trialBalance.eventType.${eventTypeCode}`);
        return eventTypeRaw || '--';
      },
    },
    { accessorKey: 'account', header: t('trialBalance.account'), size: 170 },
    {
      accessorKey: 'offsettingAccount',
      header: t('trialBalance.offsettingAccount'),
      size: 170,
    },
    {
      accessorKey: 'debitAmount',
      header: t('trialBalance.debitAmount'),
      size: 130,
    },
    {
      accessorKey: 'creditAmount',
      header: t('trialBalance.creditAmount'),
      size: 130,
    },
    {
      accessorKey: 'runningBalance',
      header: t('trialBalance.runningBalance'),
      size: 140,
    },
  ];
}
