'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
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
  useReserveReconLogQuery,
} from '@myorg/modules/reconciliation/data-access';
import { EMPTY_FIELD_VALUE } from '@myorg/modules/reconciliation/util';
import {
  ReserveReconLogModalContent,
  reserveDialogTitle,
} from './reserve-recon-log-modal-content';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReserveReconLogModalProps {
  open: boolean;
  reconciliationReserveId: number | undefined;
  /** 对账结果类型。用于 Processing Info 的结果标签。 */
  unmatchedType?: number;
  onOpenChange: (open: boolean) => void;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * ReserveReconLogModal — 储备资产对账日志只读抽屉 shell（迁移自 td-manage
 * `reconciliation/reserve/ReserveReconLogModal.tsx`，497 行）。
 *
 * shell 负责：Drawer 壳 + `useReserveReconLogQuery` 数据 + 骨架/错误态。
 * 标题按 status 动态切换（reserveDialogTitle：3→Unauthorized Movement /
 * 4→Over-minting）。主体（Warning Banner / Recon Info / 双视图对比卡 /
 * Processing Info）见 `reserve-recon-log-modal-content.tsx`（已拆出）。
 *
 * 打开触发：reserve 详情页 action `key==='ReconLog'`。Close 只读。
 */
export function ReserveReconLogModal({
  open,
  reconciliationReserveId,
  unmatchedType,
  onOpenChange,
}: ReserveReconLogModalProps) {
  const t = useTranslations('modules.reconciliation');

  const result = useReserveReconLogQuery(reconciliationReserveId, open);
  const log = result.data;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {reserveDialogTitle(t, log?.reconciliationStatus)}
          </DrawerTitle>
          <DrawerDescription>
            {t('reconciliation_0133')}:{' '}
            {log?.reconciliationNo || EMPTY_FIELD_VALUE}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result.isLoading ? (
            <ReserveReconLogSkeleton />
          ) : result.isError ? (
            <p className="py-8 text-center text-sm text-destructive" role="alert">
              {t('reconciliation_0122')}
            </p>
          ) : log ? (
            <ReserveReconLogModalContent
              log={log}
              unmatchedType={unmatchedType}
              t={t}
            />
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

function ReserveReconLogSkeleton() {
  return (
    <div className="space-y-4">
      <ReconciliationDrawerCard>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </ReconciliationDrawerCard>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
