'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import type {
  TrialBalanceActivityMeta,
  TrialBalanceActivityRow,
  TrialBalanceRow,
  TrialBalanceSummary,
} from '@myorg/modules/td-admin/data-access';

export interface TrialBalanceActivityDrawerProps {
  selectedRow: TrialBalanceRow | null;
  summary: TrialBalanceSummary;
  meta: TrialBalanceActivityMeta;
  rows: TrialBalanceActivityRow[];
  loading: boolean;
  columns: ColumnDef<TrialBalanceActivityRow>[];
  basicInfo: { financialBookName: string; bookId: string };
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

/**
 * Trial Balance 科目活动抽屉（迁移自源 `TrialBalanceActivityDrawer.tsx`）。
 * 5 字段头部 + 期初/本期借方/本期贷方/期末 4 卡片 + 交易流水表 + Close。
 */
export function TrialBalanceActivityDrawer({
  selectedRow,
  summary,
  meta,
  rows,
  loading,
  columns,
  basicInfo,
  onClose,
  t,
}: TrialBalanceActivityDrawerProps) {
  return (
    <Drawer
      open={!!selectedRow}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent className="max-w-6xl sm:w-[min(1180px,100vw)]">
        <DrawerHeader>
          <DrawerTitle>
            {selectedRow
              ? t('trialBalance.activityTitleWithAccount', {
                  account: selectedRow.accountLabel,
                })
              : t('trialBalance.activityTitle')}
          </DrawerTitle>
        </DrawerHeader>

        {selectedRow ? (
          <div className="flex max-h-[80vh] min-w-0 flex-col gap-5 overflow-auto px-4 pb-6">
            <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-4 md:grid-cols-5">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t('trialBalance.accountCode')}
                </div>
                <div className="text-sm font-semibold">
                  {selectedRow.accountCode}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t('trialBalance.accountName')}
                </div>
                <div className="text-sm font-semibold">
                  {selectedRow.accountName}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t('trialBalance.accountType')}
                </div>
                <div className="text-sm font-semibold">
                  {selectedRow.sectionType === 'assets'
                    ? t('coa.assets')
                    : t('coa.liabilities')}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t('field.bookName')}
                </div>
                <div className="text-sm font-semibold">
                  {meta.financialBookName || basicInfo.financialBookName}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t('eod.bookId')}
                </div>
                <div className="text-sm font-semibold">
                  {meta.bookId || basicInfo.bookId}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  {t('trialBalance.openingBalance')}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedRow.opening}
                </div>
                {meta.startDateText ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('trialBalance.asOfDate', { date: meta.startDateText })}
                  </div>
                ) : null}
              </div>
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  {t('trialBalance.periodDebit')}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedRow.debit}
                </div>
              </div>
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  {t('trialBalance.periodCredit')}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedRow.credit}
                </div>
              </div>
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  {t('trialBalance.closingBalance')}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedRow.closing}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t('trialBalance.asOfDate', { date: summary.asOfDate })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm font-semibold">
                {t('trialBalance.transactionJournal')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('trialBalance.period')}: {summary.periodText}
              </div>
            </div>

            <DataTable
              columns={columns}
              data={rows}
              isLoading={loading}
              emptyMessage="--"
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
