'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  CopyableEllipsisText,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Skeleton,
} from '@myorg/shared/ui';
import {
  ReconciliationDrawerCard,
} from '@myorg/modules/reconciliation/ui';
import {
  useTxReconLogQuery,
  type JournalEntry,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatNonZeroNumber,
  getDirectionKey,
} from '@myorg/modules/reconciliation/util';
import { ReconLogModalContent } from './recon-log-modal-content';

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** DataTable 要求 `{ id: string }`，JournalEntry 无 id，注入稳定行键。 */
type JournalEntryRow = JournalEntry & { id: string };

export interface RealTimeReconLogModalProps {
  open: boolean;
  reconciliationTxId: number | undefined;
  /** 对账结果类型（1=System Only / 2=On-chain Only / 3=Amount Mismatched）。
   *  ⚠️ 保留接口位但不消费：源码 resultLabel 由运行时按数据存在性推断
   *  （`resolveReconResultLabel`），不读行字段。 */
  unmatchedType?: number;
  onOpenChange: (open: boolean) => void;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * RealTimeReconLogModal — 对账日志只读抽屉 shell（迁移自 td-manage
 * `reconciliation/real-time/ReconLogModal.tsx`，573 行）。
 *
 * shell 仅负责：Drawer 壳 + `useTxReconLogQuery` 数据 + 分录列工厂 + 骨架/错误态。
 * 主体（Recon Info / Original / On-chain / Suspense / Processing Info）见
 * `recon-log-modal-content.tsx`（已拆出，含 TX_TYPE_REPOSITORY_OUT 硬编码注入、
 * resolveReconResultLabel、statusBadge resultLabel 拼接等关键逻辑）。
 */
export function RealTimeReconLogModal({
  open,
  reconciliationTxId,
  onOpenChange,
}: RealTimeReconLogModalProps) {
  const t = useTranslations('modules.reconciliation');

  const result = useTxReconLogQuery(reconciliationTxId, open);
  const log = result.data;

  // ── 分录表列工厂（Original / Suspense 共用） ────────────────────────────────
  const entryColumns = React.useMemo<ColumnDef<JournalEntryRow>[]>(
    () => [
      {
        accessorKey: 'direction',
        header: t('reconciliation_0017'),
        cell: ({ row }) => (
          <span>
            {t(getDirectionKey(row.original.direction) as never) ??
              EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        id: 'account',
        header: t('reconciliation_0016'),
        cell: ({ row }) => (
          <span className="break-all">
            {row.original.accountCode || EMPTY_FIELD_VALUE}
            {row.original.accountName
              ? ` ${row.original.accountName}`
              : ''}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('reconciliation_0040'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrencyValue(row.original.amount)}
          </span>
        ),
      },
      {
        id: 'tokenCount',
        header: t('reconciliation_0032'),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatNonZeroNumber(row.original.tokenCount)}
            {row.original.tokenSymbol ? ` ${row.original.tokenSymbol}` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'transactionId',
        header: t('reconciliation_0015'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.transactionId}
            copyLabel={t('common_copy')}
            className="max-w-[180px]"
          />
        ),
      },
    ],
    [t],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('reconciliation_0110')}</DrawerTitle>
          <DrawerDescription>{t('reconciliation_0115')}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result.isLoading ? (
            <ReconLogSkeleton />
          ) : result.isError ? (
            <p className="py-8 text-center text-sm text-destructive" role="alert">
              {t('reconciliation_0122')}
            </p>
          ) : log ? (
            <ReconLogModalContent log={log} entryColumns={entryColumns} />
          ) : null}
        </div>

        <DrawerFooter className="border-b-0">
          <DrawerClose asChild>
            <Button variant="outline">{t('common_close')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ── 骨架 ───────────────────────────────────────────────────────────────────────

function ReconLogSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <ReconciliationDrawerCard key={i}>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((__, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </ReconciliationDrawerCard>
      ))}
    </div>
  );
}
