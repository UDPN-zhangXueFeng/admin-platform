'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
  InfoItem,
  ReconciliationDrawerCard,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';
import {
  useReserveReconLogQuery,
  type ReserveReconLogRespVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatTimestamp,
  getReserveStatusKey,
  getReserveTypeKey,
  getUnmatchedTypeKey,
  RESERVE_STATUS_TONE,
} from '@myorg/modules/reconciliation/util';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReserveReconLogModalProps {
  open: boolean;
  reconciliationReserveId: number | undefined;
  /** 对账结果类型。用于 Processing Info 的结果标签。 */
  unmatchedType?: number;
  onOpenChange: (open: boolean) => void;
}


// ── 纯函数 helpers ─────────────────────────────────────────────────────────────
/** 余额 / Token 双行金额渲染。 */
function formatAmount(
  amount?: number | string,
  currency?: string,
  tokenAmount?: number | string,
  tokenSymbol?: string,
): React.ReactNode {
  if (amount == null && tokenAmount == null) return EMPTY_FIELD_VALUE;
  return (
    <span className="leading-tight">
      {amount != null ? (
        <span className="block tabular-nums">
          {formatCurrencyValue(Number(amount))} {currency ?? ''}
        </span>
      ) : null}
      {tokenAmount != null ? (
        <span className="block text-xs font-normal text-muted-foreground tabular-nums">
          {formatCurrencyValue(Number(tokenAmount))} {tokenSymbol ?? ''}
        </span>
      ) : null}
    </span>
  );
}

/** 两数相减。 */
function subtractNumber(
  minuend?: number | string,
  subtrahend?: number | string,
): number | undefined {
  if (minuend == null || subtrahend == null) return undefined;
  const result = Number(minuend) - Number(subtrahend);
  return Number.isFinite(result) ? result : undefined;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * ReserveReconLogModal — 对账日志只读抽屉（迁移自 td-manage
 * `reconciliation/reserve/ReserveReconLogModal.tsx`，497 行）。
 *
 * 调 `useReserveReconLogQuery(reconciliationReserveId)` 回显：
 * - Recon Info（8 格 KV）
 * - Mint 分支：Mintable Capacity vs Actual Execution 对比卡片
 * - Melt/Reserve Out 分支：Transaction Request vs Actual Execution 对比卡片
 * - 状态卡（Status + Amount）
 *
 * 全部只读，无表单。
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
            {t('reconciliation_0110')} — {t('reconciliation_0115')}
          </DrawerTitle>
          <DrawerDescription>
            {t('reconciliation_0133')}: {log?.reconciliationNo || EMPTY_FIELD_VALUE}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result.isLoading ? (
            <ReserveReconLogSkeleton />
          ) : result.isError ? (
            <p
              className="py-8 text-center text-sm text-destructive"
              role="alert"
            >
              {t('reconciliation_0122')}
            </p>
          ) : log ? (
            <ReserveReconLogBody log={log} unmatchedType={unmatchedType} t={t} />
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

// ── 主体组件 ───────────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'modules.reconciliation'>>;

function ReserveReconLogBody({
  log,
  unmatchedType,
  t,
}: {
  log: ReserveReconLogRespVo;
  unmatchedType?: number;
  t: TFunc;
}) {
  const mc = log.mintableCapacity;
  const ae = log.actualExecution;
  const tr = log.transactionRequest;
  const isMint = Number(log.txType) === 1;
  const isReserveOut = Number(log.txType) === 2;
  const isOverCap = Number(log.reconciliationStatus) === 4;

  const statusKey = getReserveStatusKey(log.reconciliationStatus);
  const resultKey = getUnmatchedTypeKey(unmatchedType);

  // 状态金额
  const statusAmountValue =
    isMint && isOverCap
      ? subtractNumber(mc?.mintableCapacity, ae?.executionAmount)
      : log.txAmount;
  const statusTokenCount =
    isMint && ae?.executionTokenAmount != null
      ? ae.executionTokenAmount
      : log.tokenCount;
  const statusTokenSymbol =
    isMint && ae?.executionTokenSymbol
      ? ae.executionTokenSymbol
      : log.tokenSymbol;
  const statusAmountCurrency =
    isMint && isOverCap
      ? mc?.mintableCapacityCurrency || ae?.executionAmountCurrency
      : log.txAmountCurrency || log.currencySymbol;

  const statusAmount = formatAmount(
    statusAmountValue,
    statusAmountCurrency,
    statusTokenCount,
    statusTokenSymbol,
  );

  return (
    <>
      {/* ── Warning Banner ──────────────────────────────────────────────── */}
      {isOverCap || Number(log.reconciliationStatus) === 3 ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {Number(log.reconciliationStatus) === 3
            ? t('reconciliation_0211')
            : t('reconciliation_0212')}
        </div>
      ) : null}

      {/* ── Recon Info ──────────────────────────────────────────────────── */}
      <ReconciliationDrawerCard title={t('reconciliation_0115')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <InfoItem label={t('reconciliation_0076')}>
            {formatTimestamp(log.reconciliationTime)}
          </InfoItem>
          <InfoItem label={t('reconciliation_0133')}>
            <CopyableEllipsisText
              value={log.reconciliationNo}
              copyLabel={t('common_copy')}
              className="max-w-[180px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0055')}>
            {t(
              (getReserveTypeKey(log.txType) as never) ?? EMPTY_FIELD_VALUE,
            )}
          </InfoItem>
          <InfoItem label={t('reconciliation_0015')}>
            <CopyableEllipsisText
              value={log.txHash}
              copyLabel={t('common_copy')}
              className="max-w-[200px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0047')}>
            {log.financeBookName || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0048')}>
            <CopyableEllipsisText
              value={String(log.financeBookId ?? '')}
              copyLabel={t('common_copy')}
              className="max-w-[160px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0032')}>
            {log.currencySymbol || EMPTY_FIELD_VALUE}
          </InfoItem>

          {/* 状态卡 */}
          <div className="flex justify-center">
            <div
              className={
                Number(log.reconciliationStatus) === 2
                  ? 'min-w-[104px] bg-success/20 px-4 py-3 text-sm text-success'
                  : 'min-w-[104px] bg-destructive/20 px-4 py-3 text-sm text-destructive'
              }
            >
              <StatusBadge
                tone={RESERVE_STATUS_TONE[log.reconciliationStatus]}
              >
                {statusKey
                  ? (t(statusKey as never) ?? EMPTY_FIELD_VALUE)
                  : EMPTY_FIELD_VALUE}
              </StatusBadge>
              <div className="mt-4 font-semibold">{statusAmount}</div>
            </div>
          </div>
        </div>
      </ReconciliationDrawerCard>

      {/* ── Mint 分支: Mintable Capacity vs Actual Execution ────────────── */}
      {isMint ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t('reconciliation_0215')} vs Mint Execution
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ComparisonCard title={t('reconciliation_0215')}>
              <ComparisonRow
                label={t('reconciliation_0215')}
                value={formatAmount(
                  mc?.mintableCapacity,
                  mc?.mintableCapacityCurrency,
                  mc?.mintableCapacityToken,
                  mc?.mintableCapacityTokenSymbol,
                )}
              />
              <ComparisonRow
                label={t('reconciliation_0217')}
                value={formatTimestamp(mc?.snapshotTime)}
              />
            </ComparisonCard>

            <ComparisonCard title={t('reconciliation_0218')}>
              <ComparisonRow
                label={t('reconciliation_0219')}
                value={
                  <CopyableEllipsisText
                    value={ae?.senderWalletAddress}
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                }
              />
              <ComparisonRow
                label={t('reconciliation_0220')}
                value={
                  <CopyableEllipsisText
                    value={ae?.receiverWalletAddress}
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                }
              />
              <ComparisonRow
                label={t('reconciliation_0221')}
                value={formatAmount(
                  ae?.executionAmount,
                  ae?.executionAmountCurrency,
                  ae?.executionTokenAmount,
                  ae?.executionTokenSymbol,
                )}
              />
              <ComparisonRow
                label={t('reconciliation_0223')}
                value={formatTimestamp(ae?.executionTime)}
              />
              <ComparisonRow
                label={t('reconciliation_0224')}
                value={
                  <CopyableEllipsisText
                    value={ae?.executionTxHash}
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                }
              />
            </ComparisonCard>
          </div>
        </div>
      ) : null}

      {/* ── Melt/Reserve Out 分支: Transaction Request vs Actual Execution ─ */}
      {isReserveOut ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Request vs Execution
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ComparisonCard title="Transaction Request">
              {tr && Number(log.reconciliationStatus) !== 3 ? (
                <>
                  <ComparisonRow
                    label={t('reconciliation_0226')}
                    value={formatAmount(
                      tr.meltingAmount,
                      tr.meltingAmountCurrency,
                      tr.meltingTokenAmount,
                      tr.meltingTokenSymbol,
                    )}
                  />
                  <ComparisonRow
                    label={t('reconciliation_0053')}
                    value={tr.tokenType != null ? String(tr.tokenType) : '--'}
                  />
                  <ComparisonRow
                    label={t('PUB_Blockchain')}
                    value={tr.blockchainName || EMPTY_FIELD_VALUE}
                  />
                  <ComparisonRow
                    label={t('reconciliation_0224')}
                    value={
                      <CopyableEllipsisText
                        value={ae?.executionTxHash || log.txHash}
                        copyLabel={t('common_copy')}
                        className="max-w-[200px]"
                      />
                    }
                  />
                  <ComparisonRow
                    label={t('reconciliation_0140')}
                    value={tr.createdBy || EMPTY_FIELD_VALUE}
                  />
                  <ComparisonRow
                    label={t('reconciliation_0141')}
                    value={formatTimestamp(tr.createdTime)}
                  />
                </>
              ) : (
                <div className="space-y-6 text-sm font-semibold text-destructive">
                  <div>No transaction request found</div>
                  <div>
                    This Melt was executed without a transaction request in the
                    system.
                  </div>
                </div>
              )}
            </ComparisonCard>

            <ComparisonCard title="Actual Execution">
              <ComparisonRow
                label="Transaction Ref"
                value={
                  <CopyableEllipsisText
                    value={
                      log.meltActualExecution?.transactionRef ||
                      ae?.executionTxHash
                    }
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                }
              />
              <ComparisonRow
                label="Refund Amount"
                value={formatAmount(
                  log.meltActualExecution?.refundAmount ?? ae?.executionAmount,
                  log.meltActualExecution?.refundCurrencySymbol ??
                    ae?.executionAmountCurrency,
                )}
              />
              <ComparisonRow
                label="Value Time"
                value={formatTimestamp(
                  log.meltActualExecution?.executionTime,
                )}
              />
            </ComparisonCard>
          </div>
        </div>
      ) : null}

      {/* ── Processing Info ──────────────────────────────────────────────── */}
      {unmatchedType != null ? (
        <ReconciliationDrawerCard title={t('reconciliation_0109')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoItem label={t('reconciliation_0136')}>
              <StatusBadge
                tone={RESERVE_STATUS_TONE[log.reconciliationStatus]}
              >
                {statusKey
                  ? (t(statusKey as never) ?? EMPTY_FIELD_VALUE)
                  : EMPTY_FIELD_VALUE}
              </StatusBadge>
            </InfoItem>
            <InfoItem label={t('reconciliation_0120')}>
              {resultKey
                ? (t(resultKey as never) ?? EMPTY_FIELD_VALUE)
                : EMPTY_FIELD_VALUE}
            </InfoItem>
          </div>
        </ReconciliationDrawerCard>
      ) : null}
    </>
  );
}

// ── 骨架 ───────────────────────────────────────────────────────────────────────

function ReserveReconLogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

// ── Comparison Card（本地展示组件） ───────────────────────────────────────────────

function ComparisonCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[240px] rounded-lg border bg-card p-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

function ComparisonRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] border-0 border-b border-dashed border-border py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-foreground">{value}</span>
    </div>
  );
}
