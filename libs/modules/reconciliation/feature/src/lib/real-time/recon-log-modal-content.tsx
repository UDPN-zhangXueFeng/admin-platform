'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';

import { CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { InfoItem, ReconciliationDrawerCard, StatusBadge } from '@myorg/modules/reconciliation/ui';
import {
  type JournalEntry,
  type TxReconLogRespVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  DIRECTION,
  EMPTY_FIELD_VALUE,
  RECON_STATUS_TONE,
  formatBlockHeight,
  formatCurrencyValue,
  formatNonZeroNumber,
  formatTimestamp,
  getReconStatusKey,
  getTxTypeKey,
} from '@myorg/modules/reconciliation/util';

// ── 常量 ──────────────────────────────────────────────────────────────────────

/** Repository Out 交易类型（txType===10）：硬编码注入 2002/2003 Stablecoin 分录。 */
const TX_TYPE_REPOSITORY_OUT = 10;

/** 注入分录使用的稳定科目编码（源码硬编码，照搬）。 */
const REPOSITORY_DR_ACCOUNT_CODE = '2002';
const REPOSITORY_DR_ACCOUNT_NAME = 'Stablecoin in Repository';
const CIRCULATION_CR_ACCOUNT_CODE = '2003';
const CIRCULATION_CR_ACCOUNT_NAME = 'Stablecoin in Circulation';

/** 状态 3/5/6 在 statusBadge 文案后拼接 resultLabel（与源码 statusTag 一致）。 */
const RESULT_LABEL_STATUSES = new Set<number>([3, 5, 6]);

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** DataTable 要求 `{ id: string }`，JournalEntry 无 id，注入稳定行键。 */
type JournalEntryRow = JournalEntry & { id: string };

type TFunc = ReturnType<typeof useTranslations<'modules.reconciliation'>>;

export interface ReconLogModalContentProps {
  log: TxReconLogRespVo;
  entryColumns: ColumnDef<JournalEntryRow>[];
}

// ── 纯函数 helpers（数据存在性判定 + resultLabel 推断，迁移自源码） ──────────

/** Original Entry 数据是否有效（tranId / postingDate / 任一分录）。 */
function hasOriginalData(original?: TxReconLogRespVo['originalEntry']): boolean {
  return Boolean(
    original &&
      (original.tranId ||
        original.postingDate ||
        (original.entries && original.entries.length > 0)),
  );
}

/** On-chain Details 数据是否有效。 */
function hasOnchainData(onchain?: TxReconLogRespVo['onchainDetails']): boolean {
  return Boolean(
    onchain &&
      (onchain.hash ||
        onchain.blockHeight ||
        onchain.fromAddress ||
        onchain.toAddress ||
        onchain.amount != null ||
        onchain.tokenCount != null ||
        onchain.txTime),
  );
}

/** Suspense Entries 数据是否有效。 */
function hasSuspenseData(suspense?: TxReconLogRespVo['suspenseEntries']): boolean {
  return Boolean(
    suspense &&
      (suspense.tranId ||
        suspense.postingDate ||
        suspense.exceptionContext ||
        (suspense.entries && suspense.entries.length > 0)),
  );
}

/**
 * 推断对账结果 i18n key（相对 key，不带 `reconciliation.` 前缀）。
 *
 * 迁移自源码 `resolveReconResultLabel`：
 * - 无 onchain 数据 → `unmatched_type_1`（仅系统有，源码 reconciliation_0112）
 * - 无 original 数据 → `unmatched_type_2`（仅链上有，源码 reconciliation_0113）
 * - 有 suspense 数据 → `unmatched_type_3`（金额不匹配，源码 reconciliation_0114）
 * - 其余 → 返回空串（不拼接）
 *
 * 注：目标侧 `unmatched_type_*` 文案与源码 0112/0113/0114 完全一致，
 * 统一走 util 现有 key（DRY），不另引 0112/0113/0114。
 */
function resolveReconResultLabel(
  original?: TxReconLogRespVo['originalEntry'],
  onchain?: TxReconLogRespVo['onchainDetails'],
  suspense?: TxReconLogRespVo['suspenseEntries'],
): string {
  if (!hasOnchainData(onchain)) return 'unmatched_type_1';
  if (!hasOriginalData(original)) return 'unmatched_type_2';
  if (hasSuspenseData(suspense)) return 'unmatched_type_3';
  return '';
}

// ── Dr/Cr 合计 ────────────────────────────────────────────────────────────────

/** 计算 Dr/Cr 合计与差额（借方合计 − 贷方合计）。 */
function computeTotals(entries: JournalEntry[]): {
  dr: number;
  cr: number;
  diff: number;
} {
  let dr = 0;
  let cr = 0;
  for (const e of entries) {
    if (e.direction === DIRECTION.DEBIT) dr += e.amount;
    else if (e.direction === DIRECTION.CREDIT) cr += e.amount;
  }
  return { dr, cr, diff: dr - cr };
}

/**
 * Repository Out（txType===10）硬编码注入 2002/2003 Stablecoin 分录；
 * 其余 txType 原样回显。迁移自源码 `originalEntries` useMemo。
 */
function buildOriginalEntries(
  txType: number | undefined,
  original?: TxReconLogRespVo['originalEntry'],
): JournalEntry[] {
  const entries = original?.entries ?? [];
  if (txType !== TX_TYPE_REPOSITORY_OUT || entries.length === 0) {
    return entries;
  }

  const amount = entries[0]?.amount;
  return [
    {
      ...entries[0],
      direction: DIRECTION.DEBIT,
      accountCode: REPOSITORY_DR_ACCOUNT_CODE,
      accountName: REPOSITORY_DR_ACCOUNT_NAME,
      amount,
    },
    {
      ...entries[1],
      direction: DIRECTION.CREDIT,
      accountCode: CIRCULATION_CR_ACCOUNT_CODE,
      accountName: CIRCULATION_CR_ACCOUNT_NAME,
      amount,
    },
  ];
}

/** 注入稳定行键，满足 DataTable `{ id: string }` 契约。 */
function toRows(
  entries: JournalEntry[] | undefined,
  prefix: string,
): JournalEntryRow[] {
  return (entries ?? []).map((e, i) => ({ ...e, id: `${prefix}-${i}` }));
}

// ── 主体 ──────────────────────────────────────────────────────────────────────

/**
 * ReconLogModalContent — 对账日志只读抽屉主体（已从 shell 拆出，
 * 便于骨架/错误态早返，避免 nx 对超大文件的 lazy 误报）。
 *
 * 对照源码 `reconciliation/real-time/ReconLogModal.tsx` 补全：
 * - TX_TYPE_REPOSITORY_OUT(10) 硬编码注入 2002/2003 Stablecoin 分录；
 * - `resolveReconResultLabel` 运行时按数据存在性推断结果标签；
 * - statusBadge 在 3/5/6 拼接 resultLabel；
 * - On-chain / Suspense 仅在有数据时渲染（源码有条件渲染）。
 */
export function ReconLogModalContent({
  log,
  entryColumns,
}: ReconLogModalContentProps) {
  const t = useTranslations('modules.reconciliation');

  const onchain = log.onchainDetails;
  const suspense = log.suspenseEntries;
  const statusKey = getReconStatusKey(log.reconciliationStatus);
  const resultLabelKey = resolveReconResultLabel(
    log.originalEntry,
    onchain,
    suspense,
  );
  const resultLabel = resultLabelKey
    ? (t(resultLabelKey as never) ?? '')
    : '';
  const showResultSuffix =
    resultLabel &&
    RESULT_LABEL_STATUSES.has(Number(log.reconciliationStatus));
  const statusText = statusKey
    ? (t(statusKey as never) ?? EMPTY_FIELD_VALUE)
    : EMPTY_FIELD_VALUE;
  const statusDisplay = showResultSuffix
    ? `${statusText} (${resultLabel})`
    : statusText;

  // ── 行数据（注入 id + Repository Out 硬编码注入） ──────────────────────────
  const originalEntries = React.useMemo(
    () => buildOriginalEntries(log.txType, log.originalEntry),
    [log.txType, log.originalEntry],
  );
  const originalRows = React.useMemo(
    () => toRows(originalEntries, 'orig'),
    [originalEntries],
  );
  const suspenseRows = React.useMemo(
    () => toRows(suspense?.entries, 'susp'),
    [suspense?.entries],
  );

  const originalTotals = React.useMemo(
    () => computeTotals(originalEntries),
    [originalEntries],
  );
  const suspenseTotals = React.useMemo(
    () => computeTotals(suspense?.entries ?? []),
    [suspense?.entries],
  );

  const showSuspenseBlock =
    !!suspense && !!suspense.entries && suspense.entries.length > 0;

  return (
    <>
      {/* ── Recon Info（statusBadge 在 3/5/6 拼 resultLabel） ────────────────── */}
      <ReconciliationDrawerCard title={t('reconciliation_0115')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <InfoItem label={t('reconciliation_0133')}>
            {log.reconciliationNo || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0055')}>
            {t(getTxTypeKey(log.txType) as never) ?? EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0136')}>
            <StatusBadge tone={RECON_STATUS_TONE[log.reconciliationStatus]}>
              {statusDisplay}
            </StatusBadge>
          </InfoItem>
          <InfoItem label={t('reconciliation_0077')}>
            {log.financeBookName || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0048')}>
            {log.bookNo || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0032')}>
            {log.currencySymbol || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0015')}>
            <CopyableEllipsisText
              value={log.tranId}
              copyLabel={t('common_copy')}
              className="max-w-[200px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0139')}>
            {formatTimestamp(log.reconciliationTime)}
          </InfoItem>
        </div>
      </ReconciliationDrawerCard>

      {/* ── Original Entry（txType===10 硬编码注入 2002/2003） ───────────────── */}
      <ReconciliationDrawerCard title={t('reconciliation_0035')}>
        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InfoItem label={t('reconciliation_0015')}>
            <CopyableEllipsisText
              value={log.originalEntry?.tranId}
              copyLabel={t('common_copy')}
              className="max-w-[200px]"
            />
          </InfoItem>
          <InfoItem label={t('reconciliation_0039')}>
            {formatTimestamp(log.originalEntry?.postingDate)}
          </InfoItem>
        </div>
        <DataTable
          columns={entryColumns}
          data={originalRows}
          emptyMessage={t('reconciliation_0116')}
        />
        <TotalsBar totals={originalTotals} t={t} />
      </ReconciliationDrawerCard>

      {/* ── On-chain Details（仅 hasOnchainData 渲染） ────────────────────────── */}
      {hasOnchainData(onchain) ? (
        <ReconciliationDrawerCard title={t('reconciliation_0117')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoItem label={t('reconciliation_0118')}>
              {formatBlockHeight(onchain?.blockHeight)}
            </InfoItem>
            <InfoItem label={t('reconciliation_0057')}>
              {formatTimestamp(onchain?.txTime)}
            </InfoItem>
            <InfoItem label={t('reconciliation_0040')}>
              <span className="tabular-nums">
                {formatCurrencyValue(onchain?.amount)}
              </span>
            </InfoItem>
            <InfoItem label={t('reconciliation_0032')}>
              {formatNonZeroNumber(onchain?.tokenCount)}
              {onchain?.tokenSymbol ? ` ${onchain.tokenSymbol}` : ''}
            </InfoItem>
            <InfoItem label={t('reconciliation_0050')}>
              <CopyableEllipsisText
                value={onchain?.fromAddress}
                copyLabel={t('common_copy')}
                className="max-w-[220px]"
              />
            </InfoItem>
            <InfoItem label={t('reconciliation_0051')}>
              <CopyableEllipsisText
                value={onchain?.toAddress}
                copyLabel={t('common_copy')}
                className="max-w-[220px]"
              />
            </InfoItem>
            <InfoItem label={t('reconciliation_0058')} className="sm:col-span-2">
              <CopyableEllipsisText
                value={onchain?.hash ?? log.txHash}
                copyLabel={t('common_copy')}
                className="max-w-[480px]"
              />
            </InfoItem>
          </div>
        </ReconciliationDrawerCard>
      ) : null}

      {/* ── Suspense Entries（仅已挂账行展示，suspense.entries 非空） ─────────── */}
      {showSuspenseBlock ? (
        <ReconciliationDrawerCard title={t('reconciliation_0119')}>
          <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <InfoItem label={t('reconciliation_0044')}>
              {suspense?.exceptionContext || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0131')}>
              {suspense?.processedBy || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0132')}>
              {formatTimestamp(suspense?.processedTime)}
            </InfoItem>
          </div>
          <DataTable
            columns={entryColumns}
            data={suspenseRows}
            emptyMessage={t('reconciliation_0116')}
          />
          <TotalsBar totals={suspenseTotals} t={t} />
        </ReconciliationDrawerCard>
      ) : null}

      {/* ── Processing Info（resultLabel 由运行时推断，非 props 字段） ───────── */}
      {(suspense?.processedBy || suspense?.processedTime || resultLabelKey) ? (
        <ReconciliationDrawerCard title={t('reconciliation_0109')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoItem label={t('reconciliation_0136')}>
              <StatusBadge tone={RECON_STATUS_TONE[log.reconciliationStatus]}>
                {statusDisplay}
              </StatusBadge>
            </InfoItem>
            <InfoItem label={t('reconciliation_0120')}>
              {resultLabel || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0131')}>
              {suspense?.processedBy || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0132')}>
              {formatTimestamp(suspense?.processedTime)}
            </InfoItem>
          </div>
        </ReconciliationDrawerCard>
      ) : null}
    </>
  );
}

// ── Dr/Cr 合计条 ───────────────────────────────────────────────────────────────

function TotalsBar({
  totals,
  t,
}: {
  totals: { dr: number; cr: number; diff: number };
  t: TFunc;
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-1 pt-3 text-sm text-muted-foreground">
      <span>
        {t('reconciliation_0128')}:{' '}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrencyValue(totals.dr)}
        </span>
      </span>
      <span>
        {t('reconciliation_0129')}:{' '}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrencyValue(totals.cr)}
        </span>
      </span>
      <span>
        {t('reconciliation_0130')}:{' '}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrencyValue(totals.diff)}
        </span>
      </span>
    </div>
  );
}
