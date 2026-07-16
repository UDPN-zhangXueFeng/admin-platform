'use client';

import { useEffect, useMemo, useState } from 'react';
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
  EodSuspenseEntryRow,
} from '@myorg/modules/chart-of-accounts/data-access';

export interface ReviewSuspensePostingsDrawerProps {
  open: boolean;
  detail: EodStatementDetail | null;
  t: (key: string) => string;
  onCancel: () => void;
  onConfirm: (comments: string) => void;
}

/**
 * Review Suspense Postings Drawer（迁移自源 ReviewSuspensePostingsModal.tsx）。
 * Assets/Liabilities 卡片 + 拟议暂记分录表 + Comments + Confirm（源 Confirm onClick 占位）。
 */
export function ReviewSuspensePostingsDrawer({
  open,
  detail,
  t,
  onCancel,
  onConfirm,
}: ReviewSuspensePostingsDrawerProps) {
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (!open) setComments('');
  }, [open]);

  const columns = useMemo<ColumnDef<EodSuspenseEntryRow>[]>(
    () => [
      { accessorKey: 'postingDate', header: t('eod.postingDate') },
      {
        accessorKey: 'voucherId',
        header: t('eod.voucherId'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.voucherId}
            copyable={row.original.voucherId !== '--'}
            maxWidth={180}
          />
        ),
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
        header: t('eod.suspenseTxnId'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.transactionId}
            copyable={row.original.transactionId !== '--'}
            maxWidth={160}
          />
        ),
      },
    ],
    [t]
  );

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DrawerContent className="max-w-5xl sm:w-[min(1080px,100vw)]">
        <DrawerHeader>
          <DrawerTitle>{t('eod.reviewSuspenseTitle')}</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[80vh] overflow-auto px-4 pb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">{t('eod.totalAssets')}</div>
              <div className="mt-2 text-xl font-semibold">
                {detail?.summaryTotalAssets ?? '--'}
              </div>
              <div className="my-3 border-t" />
              <div className="text-xs text-muted-foreground">
                {t('eod.ofWhichSuspenseAssets')}:{' '}
                <span className="font-semibold">{detail?.suspenseAssets ?? '--'}</span>
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">{t('eod.totalLiabilities')}</div>
              <div className="mt-2 text-xl font-semibold">
                {detail?.summaryTotalLiabilities ?? '--'}
              </div>
              <div className="my-3 border-t" />
              <div className="text-xs text-muted-foreground">
                {t('eod.ofWhichSuspenseLiabilities')}:{' '}
                <span className="font-semibold">{detail?.suspenseLiabilities ?? '--'}</span>
              </div>
            </div>
          </div>

          <div className="mb-2 mt-4 text-sm font-semibold">
            {t('eod.proposedSuspenseEntries')}
          </div>
          <DataTable columns={columns} data={detail?.suspenseRows ?? []} emptyMessage="--" />

          <div className="mb-1 mt-4 text-sm">
            <span className="text-red-600">*</span> {t('eod.comments')}
          </div>
          <textarea
            value={comments}
            maxLength={200}
            rows={4}
            placeholder={t('eod.commentsPlaceholder')}
            onChange={(event) => setComments(event.target.value)}
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
          />

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => onConfirm(comments)}>{t('common.confirm')}</Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
