'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';

import {
  Card,
  CopyableEllipsisText,
  DataTable,
  DetailField,
  DetailGrid,
  DetailSection,
  PageHeader,
} from '@myorg/shared/ui';

import {
  useSuspenseEntryDetailQuery,
  type SuspenseAdjustmentHistoryItem,
} from '@myorg/modules/td-admin/data-access';
import {
  ADJUSTMENT_STATUS_MAP,
  CLEAR_STATUS_MAP,
  formatAmount,
  textOrDash,
} from '@myorg/modules/td-admin/data-access';
import { SuspenseStatusBadge } from '.';
import { SuspenseEntryTable } from './suspense-entry-table';
import {
  createRowActionsColumn,
  renderRowActions,
  type RowActionsOptions,
} from '../row-actions';

/** 审批业务码（源 view.tsx 常量，history 行无 busCode 时兜底）。 */
const SUSPENSE_ADJUSTMENT_BUS_CODE = 'fin_suspense_adjustment';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function SuspenseAdjustmentDetailPage() {
  const t = useTranslations('modules.suspense-adjustment');
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspenseRecordId = parseId(searchParams.get('id'));

  const { data: detail, isLoading, error } = useSuspenseEntryDetailQuery(suspenseRecordId);


  const historyColumns = React.useMemo<
    ColumnDef<SuspenseAdjustmentHistoryItem>[]
  >(
    () => {
      const historyActionsOptions: RowActionsOptions<SuspenseAdjustmentHistoryItem> = {
        detail: (row) => {
          const taskId = row.taskId ?? row.adjustmentId;
          const busCode = row.busCode ?? SUSPENSE_ADJUSTMENT_BUS_CODE;
          return taskId
            ? {
                label: t('action.detail'),
                onClick: () =>
                  router.push(
                    `/approval-manage/view?${new URLSearchParams({ id: String(taskId), busCode })}`,
                  ),
              }
            : undefined;
        },
      };
      return [
      {
        accessorKey: 'postingDate',
        header: t('field.postingDate'),
        cell: ({ row }) => <span>{textOrDash(row.original.postingDate)}</span>,
      },
      {
        accessorKey: 'offsetAccountDisplay',
        header: t('field.offsetAccount'),
        cell: ({ row }) => (
          <span>{textOrDash(row.original.offsetAccountDisplay)}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('field.amount'),
        cell: ({ row }) => formatAmount(row.original.amount, detail?.currency),
      },
      {
        accessorKey: 'adjustmentReason',
        header: t('field.adjustmentReason'),
        cell: ({ row }) => (
          <span>{textOrDash(row.original.adjustmentReason)}</span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('field.createdBy'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdBy)}</span>,
      },
      {
        accessorKey: 'createdOn',
        header: t('field.createdOn'),
        cell: ({ row }) => <span>{textOrDash(row.original.createdOn)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <SuspenseStatusBadge
            tone={ADJUSTMENT_STATUS_MAP[row.original.status]?.color ?? 'default'}
            label={row.original.statusLabel}
          />
        ),
      },
      {
        ...createRowActionsColumn<SuspenseAdjustmentHistoryItem>(historyActionsOptions),
        cell: ({ row }) =>
          row.original.canViewDetails ? (
            renderRowActions(row.original, historyActionsOptions)
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      ];
    },
    [t, router, detail?.currency],
  );

  const header = <PageHeader backLabel={t('action.back')} onBack={() => router.back()} title={t('detail.title')} />;

  if (!suspenseRecordId) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        </Card>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="space-y-4">
        {header}
        <DetailSection
          title={t('detail.basicInformation')}
          loading={isLoading}
          skeleton="fields"
        >
          <p
            role={error ? 'alert' : undefined}
            className={
              error
                ? 'text-sm text-destructive'
                : 'text-sm text-muted-foreground'
            }
          >
            {error?.message || t('empty')}
          </p>
        </DetailSection>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {/* Basic Details */}
      <DetailSection title={t('detail.basicInformation')}>
        <DetailGrid>
          <DetailField
            span="full"
            label={t('field.suspenseTxnId')}
            value={
              <CopyableEllipsisText
                value={detail.suspenseTxnId}
                showCopyIcon
                maxWidth={480}
              />
            }
          />
          <DetailField
            label={t('field.status')}
            value={
              <SuspenseStatusBadge
                tone={CLEAR_STATUS_MAP[detail.status]?.color ?? 'default'}
                label={detail.statusLabel}
              />
            }
          />
          <DetailField
            label={t('field.sourceType')}
            value={textOrDash(detail.sourceTypeLabel)}
          />
          <DetailField
            label={t('field.age')}
            value={t('ageDays', { count: detail.age })}
          />
          <DetailField
            label={t('field.transactionType')}
            value={textOrDash(detail.transactionTypeLabel)}
          />
          <DetailField
            label={t('field.financeBookName')}
            value={textOrDash(detail.financeBookName)}
          />
          <DetailField
            label={t('field.bookId')}
            value={
              <CopyableEllipsisText
                value={detail.bookNo || detail.bookId}
                showCopyIcon
                maxWidth={320}
              />
            }
          />
        </DetailGrid>
      </DetailSection>

      {/* Suspense Entries */}
      <DetailSection title={t('detail.suspenseEntries')}>
        <SuspenseEntryTable detail={detail} />
      </DetailSection>

      {/* Amount Summary */}
      <DetailSection title={t('detail.amountSummary')}>
        <DetailGrid className="sm:grid-cols-3">
          <DetailField
            label={t('field.originalAmount')}
            value={
              <span className="font-semibold">
                {formatAmount(detail.originalAmount, detail.currency)}
              </span>
            }
          />
          <DetailField
            label={t('field.totalAdjusted')}
            value={formatAmount(detail.totalAdjusted, detail.currency)}
          />
          <DetailField
            label={t('field.outstandingAmount')}
            value={
              <span className="font-semibold text-destructive">
                {formatAmount(detail.outstandingAmount, detail.currency)}
              </span>
            }
          />
        </DetailGrid>
      </DetailSection>

      {/* Adjustment History */}
      <DetailSection title={t('detail.adjustmentHistory')}>
        <DataTable
          columns={historyColumns}
          data={detail.adjustmentHistory}
          emptyMessage={t('empty')}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {t('range', {
            start: detail.adjustmentHistory.length ? 1 : 0,
            end: detail.adjustmentHistory.length,
            total: detail.adjustmentHistory.length,
          })}
        </p>
      </DetailSection>
    </div>
  );
}
