'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import type {
  EodStatementDetail,
  EodStatementRow,
  EodSuspenseEntryRow,
} from '@myorg/modules/chart-of-accounts/data-access';

/**
 * EOD 明细抽屉（迁移自源 EodDetailDrawer.tsx）。
 *
 * antd Drawer（右侧）→ shared/ui Drawer（Radix Dialog，右侧，className 覆盖宽度）。
 * 顶部 5 字段网格 + Total Assets/Liabilities 卡片 + Suspense Entries 表格。
 * 注：源用 antd Table rowSpan 合并相邻同 ID 行；TanStack DataTable 不支持 rowSpan，
 * 这里逐行展示（数据完整，视觉略简）。
 */
export interface EodDetailDrawerProps {
  open: boolean;
  statement: EodStatementRow | null;
  detail: EodStatementDetail | null;
  basicInfo: { financialBookName: string };
  onClose: () => void;
  t: (key: string) => string;
}

export function EodDetailDrawer({
  open,
  statement,
  detail,
  basicInfo,
  onClose,
  t,
}: EodDetailDrawerProps) {
  const suspenseColumns = useMemo<ColumnDef<EodSuspenseEntryRow>[]>(
    () => [
      { accessorKey: 'postingDate', header: t('eod.postingDate') },
      {
        accessorKey: 'voucherId',
        header: t('eod.voucherId'),
        cell: ({ row }) => <CopyableEllipsisText value={row.original.voucherId} copyable={row.original.voucherId !== '--'} maxWidth={140} />,
      },
      {
        accessorKey: 'drCr',
        header: t('eod.drCr'),
        cell: ({ row }) => (
          <span className={row.original.drCr === 'Cr' ? 'text-red-600' : 'text-blue-600'}>
            {row.original.drCr}
          </span>
        ),
      },
      { accessorKey: 'account', header: t('eod.account') },
      { accessorKey: 'amount', header: t('eod.amount') },
      {
        accessorKey: 'transactionId',
        header: t('eod.transactionId'),
        cell: ({ row }) => <CopyableEllipsisText value={row.original.transactionId} copyable={row.original.transactionId !== '--'} maxWidth={140} />,
      },
    ],
    [t]
  );

  const titleBookName =
    detail?.bookName && detail.bookName !== '--'
      ? detail.bookName
      : basicInfo.financialBookName;
  const titleCurrency = detail?.currencyCode ? ` (${detail.currencyCode})` : '';
  const isBalanced = detail?.balancingStatus === 'balanced';

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DrawerContent className="max-w-5xl sm:w-[min(1080px,100vw)]">
        <DrawerHeader>
          <DrawerTitle>
            {t('eod.detailTitle')}: {titleBookName || '--'}
            {titleCurrency}
          </DrawerTitle>
        </DrawerHeader>

        {statement ? (
          <div className="flex max-h-[80vh] min-w-0 flex-col overflow-auto px-4 pb-6">
            {/* 顶部 5 字段 */}
            <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-4 md:grid-cols-5">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('eod.date')}</div>
                <div className="text-sm font-semibold whitespace-nowrap">
                  {detail?.postingDate || statement.eodDate}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('field.bookName')}</div>
                <div className="text-sm font-semibold whitespace-nowrap">
                  {detail?.bookName || titleBookName || '--'}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('eod.bookId')}</div>
                <div className="text-sm font-semibold">
                  <CopyableEllipsisText value={detail?.bookId} maxWidth={160} />
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('eod.accountingStatus')}</div>
                <div
                  className={
                    !detail
                      ? 'text-sm font-semibold text-muted-foreground'
                      : isBalanced
                        ? 'text-sm font-semibold text-green-600'
                        : 'text-sm font-semibold text-red-600'
                  }
                >
                  {!detail ? '--' : isBalanced ? t('eod.balanced') : t('eod.unbalanced')}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('eod.processedBy')}</div>
                <div className="text-sm font-semibold whitespace-nowrap">
                  {detail?.processedBy || statement.closedBy}
                </div>
              </div>
            </div>

            {/* Assets / Liabilities 卡片 */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">{t('eod.totalAssets')}</div>
                <div className="mt-2 text-xl font-semibold">
                  {detail?.summaryTotalAssets || '--'}
                </div>
                <div className="my-3 border-t" />
                <div className="text-xs text-muted-foreground">
                  {t('eod.ofWhichSuspenseAssets')}:{' '}
                  <span className="font-semibold">{detail?.suspenseAssets || '--'}</span>
                </div>
              </div>
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">{t('eod.totalLiabilities')}</div>
                <div className="mt-2 text-xl font-semibold">
                  {detail?.summaryTotalLiabilities || '--'}
                </div>
                <div className="my-3 border-t" />
                <div className="text-xs text-muted-foreground">
                  {t('eod.ofWhichSuspenseLiabilities')}:{' '}
                  <span className="font-semibold">{detail?.suspenseLiabilities || '--'}</span>
                </div>
              </div>
            </div>

            {/* Suspense Entries */}
            <div className="mb-2 mt-6 text-sm font-semibold">{t('eod.suspenseEntries')}</div>
            <DataTable
              columns={suspenseColumns}
              data={detail?.suspenseRows ?? []}
              emptyMessage="--"
            />

            <div className="mt-6 flex justify-end">
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
