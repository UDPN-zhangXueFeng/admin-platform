'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  InfoItem,
  ReconciliationDrawerCard,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';
import {
  type ReserveReconLogRespVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatTimestamp,
  getReserveStatusKey,
  getReserveTypeKey,
  getTokenTypeKey,
  getUnmatchedTypeKey,
  RESERVE_STATUS_TONE,
} from '@myorg/modules/reconciliation/util';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReserveReconLogModalContentProps {
  log: ReserveReconLogRespVo;
  /** 对账结果类型。用于 Processing Info 的结果标签。 */
  unmatchedType?: number;
  t: TFunc;
}

// ── 纯函数 helpers ─────────────────────────────────────────────────────────────

/**
 * 警告条文案：status 3/4/5 硬编码英文（源码 ReserveReconLogModal.tsx:41 原样照搬，
 * 验证文档 8.2.9 要求硬编码英文不强行 i18n 化）。
 */
export function reserveWarningText(status?: number): string {
  switch (Number(status)) {
    case 3:
      return 'No transaction request found. A reserve movement without an approved request. This is a compliance risk - escalate immediately.';
    case 4:
      return 'Minted volume exceeds available reserve balance. Immediate reconciliation required.';
    case 5:
      return 'Reserve reconciliation failed. Immediate reconciliation required.';
    default:
      return '';
  }
}

/**
 * Drawer 标题：status 3→Unauthorized Movement / 4→Over-minting，其余回退通用标题
 * （源码 ReserveReconLogModal.tsx:54 原样照搬）。
 */
export function reserveDialogTitle(t: TFunc, status?: number): string {
  switch (Number(status)) {
    case 3:
      return 'Unauthorized Movement';
    case 4:
      return 'Over-minting';
    default:
      return t('reconciliation_0110');
  }
}

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

/** reserve status → 状态卡 className（status 2 绿/其他红，源码 65 原样）。 */
function reserveStatusCardClassName(status?: number): string {
  return Number(status) === 2
    ? 'min-w-[104px] bg-success/20 px-4 py-3 text-sm text-success'
    : 'min-w-[104px] bg-destructive/20 px-4 py-3 text-sm text-destructive';
}

// ── 类型 ───────────────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'modules.reconciliation'>>;

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * ReserveReconLogModalContent — 对账日志只读抽屉主体（迁移自 td-manage
 * `reconciliation/reserve/ReserveReconLogModal.tsx`，497 行）。
 *
 * 回显：
 * - Warning Banner（status 3/4/5 硬编码英文警告）
 * - Recon Info（7 格 KV + statusLabel 卡片含金额）
 * - Mint 分支：Mintable Capacity vs Actual Execution 对比卡片
 * - Melt/Reserve Out 分支：Transaction Request vs Actual Execution 对比卡片
 *   （无 request 时红色 Unauthorized 提示）
 * - Processing Info（unmatchedType 非空时）
 *
 * 纯渲染，数据由 shell 通过 `useReserveReconLogQuery` 拉取后注入。
 */
export function ReserveReconLogModalContent({
  log,
  unmatchedType,
  t,
}: ReserveReconLogModalContentProps) {
  return (
    <ReserveReconLogBody log={log} unmatchedType={unmatchedType} t={t} />
  );
}

// ── 主体组件 ───────────────────────────────────────────────────────────────────

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
  const melt = log.meltActualExecution;
  const status = Number(log.reconciliationStatus);
  const isMint = Number(log.txType) === 1;
  const isReserveOut = Number(log.txType) === 2;
  const isUnauthorized = status === 3;
  const isOverCap = status === 4;

  const statusKey = getReserveStatusKey(log.reconciliationStatus);
  const resultKey = getUnmatchedTypeKey(unmatchedType);
  const warningText = reserveWarningText(log.reconciliationStatus);

  // 状态金额（mint+overcap 用 mintableCapacity-executionAmount 推断）
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

  // tokenType → 名称（对齐源 tokenTypeLabelMap + 目标 token_type_${n} 约定）
  const tokenTypeLabel = (tokenType?: number): string => {
    if (tokenType == null) return EMPTY_FIELD_VALUE;
    const key = getTokenTypeKey(tokenType);
    return key ? (t(key as never) ?? EMPTY_FIELD_VALUE) : EMPTY_FIELD_VALUE;
  };

  return (
    <>
      {/* ── Warning Banner（status 3/4/5 硬编码英文警告）──────────────────── */}
      {warningText ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {warningText}
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
            {(() => {
              const key = getReserveTypeKey(log.txType);
              return key
                ? (t(key as never) ?? EMPTY_FIELD_VALUE)
                : EMPTY_FIELD_VALUE;
            })()}
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
              value={log.financeBookId != null ? String(log.financeBookId) : ''}
              copyLabel={t('common_copy')}
              className="max-w-[160px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0032')}>
            {log.currencySymbol || EMPTY_FIELD_VALUE}
          </InfoItem>

          {/* 状态卡（status 2 绿/其他红） */}
          <div className="flex justify-center">
            <div
              className={reserveStatusCardClassName(log.reconciliationStatus)}
            >
              <div>
                {statusKey
                  ? (t(statusKey as never) ?? EMPTY_FIELD_VALUE)
                  : EMPTY_FIELD_VALUE}
              </div>
              <div className="mt-4 font-semibold">{statusAmount}</div>
            </div>
          </div>
        </div>
      </ReconciliationDrawerCard>

      {/* ── Melt/Reserve Out 分支: Transaction Request vs Actual Execution ─ */}
      {isReserveOut ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Request vs Execution
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ComparisonCard title="Transaction Request">
              {tr && !isUnauthorized ? (
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
                    value={tokenTypeLabel(tr.tokenType)}
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
                    value={melt?.transactionRef || ae?.executionTxHash}
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                }
              />
              <ComparisonRow
                label="Refund Amount"
                value={formatAmount(
                  melt?.refundAmount ?? ae?.executionAmount,
                  melt?.refundCurrencySymbol ?? ae?.executionAmountCurrency,
                )}
              />
              <ComparisonRow
                label="Value Time"
                value={formatTimestamp(melt?.executionTime)}
              />
            </ComparisonCard>
          </div>
        </div>
      ) : null}

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

      {/* ── Processing Info ──────────────────────────────────────────────── */}
      {unmatchedType != null ? (
        <ReconciliationDrawerCard title={t('reconciliation_0109')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoItem label={t('reconciliation_0136')}>
              <StatusBadge tone={RESERVE_STATUS_TONE[log.reconciliationStatus]}>
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
