'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Skeleton,
} from '@myorg/shared/ui';
import { ReconciliationDrawerCard } from '@myorg/modules/reconciliation/ui';
import { useTxReconLogQuery } from '@myorg/modules/reconciliation/data-access';
import {
  PostToSuspenseModalContent,
  type AmountBlock,
} from './post-to-suspense-modal-content';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostToSuspenseModalProps {
  open: boolean;
  reconciliationTxId: number | undefined;
  /**
   * Unmatched 类型（来自列表行 TxReconDetailRespVo.unmatchedType），作 fallback。
   * content 内 `resolveDisplayUnmatchedType` 会按 original/onchain/suspense 数据
   * 存在性推断展示类型，仅当三者都存在时才回退到此值。
   */
  unmatchedType?: number;
  /** 链上金额块（On-chain amount 回显，源码 postedAmount）。 */
  postedAmount?: AmountBlock;
  /** 差异金额块（chainAmount − financeAmount，源码 mismatchedAmount）。 */
  mismatchedAmount?: AmountBlock;
  onOpenChange: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * PostToSuspenseModal — Token 挂账抽屉 shell（迁移自 td-manage
 * `reconciliation/real-time/PostToSuspenseModal.tsx`，767 行）。
 *
 * shell 仅负责：Drawer 壳 + `useTxReconLogQuery` 数据 + 骨架/错误态 + 标题（按
 * 展示 unmatched 类型拼接）。主体（Recon Info / Original / On-chain / Suspense
 * 只读表 / Exception Context + footer）见 `post-to-suspense-modal-content.tsx`，
 * 含 `resolveDisplayUnmatchedType` / `mapSuggestedSuspenseEntries` /
 * `toPostingDateEpoch` / `canConfirm` / `unmatchedTypeTag` 完整逻辑。
 *
 * financeBookId 仅 reserve 域 leafAccounts 下拉用，本抽屉建议分录只读不消费，
 * 故 shell 不查询 leafAccounts（与源码一致：real-time 不调 tx/accounts/leaf）。
 */
export function PostToSuspenseModal({
  open,
  reconciliationTxId,
  unmatchedType,
  postedAmount,
  mismatchedAmount,
  onOpenChange,
}: PostToSuspenseModalProps) {
  const t = useTranslations('modules.reconciliation');

  // ── 回显数据：tx/recon-log ──────────────────────────────────────────────────
  const result = useTxReconLogQuery(reconciliationTxId, open);
  const log = result.data;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('reconciliation_0095')}</DrawerTitle>
          <DrawerDescription>{t('reconciliation_0115')}</DrawerDescription>
        </DrawerHeader>

        {result.isLoading ? (
          <PostToSuspenseSkeleton />
        ) : result.isError ? (
          <p
            className="py-8 text-center text-sm text-destructive"
            role="alert"
          >
            {t('reconciliation_0122')}
          </p>
        ) : log ? (
          <PostToSuspenseModalContent
            log={log}
            unmatchedType={unmatchedType}
            postedAmount={postedAmount}
            mismatchedAmount={mismatchedAmount}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

// ── 骨架 ───────────────────────────────────────────────────────────────────────

function PostToSuspenseSkeleton() {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
