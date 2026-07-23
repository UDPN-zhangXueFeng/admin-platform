'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
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
  useTxReconLogQuery,
  type JournalEntry,
  type TxReconLogRespVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  RECON_STATUS_TONE,
  formatBlockHeight,
  formatCurrencyValue,
  formatNonZeroNumber,
  formatTimestamp,
  getDirectionKey,
  getReconStatusKey,
  getTxTypeKey,
  getUnmatchedTypeKey,
} from '@myorg/modules/reconciliation/util';

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** DataTable 要求 `{ id: string }`，JournalEntry 无 id，注入稳定行键。 */
type JournalEntryRow = JournalEntry & { id: string };

export interface RealTimeReconLogModalProps {
  open: boolean;
  reconciliationTxId: number | undefined;
  /** 对账结果类型（1=System Only / 2=On-chain Only / 3=Amount Mismatched），
   *  来自详情页行 `unmatchedType`，用于 Processing Info 的结果标签。 */
  unmatchedType?: number;
  onOpenChange: (open: boolean) => void;
}

// ── 纯函数 helpers ─────────────────────────────────────────────────────────────

/** 计算 Dr/Cr 合计与差额（借方合计 − 贷方合计）。 */
function computeTotals(entries: JournalEntry[]): {
  dr: number;
  cr: number;
  diff: number;
} {
  let dr = 0;
  let cr = 0;
  for (const e of entries) {
    if (e.direction === 1) dr += e.amount;
    else if (e.direction === 2) cr += e.amount;
  }
  return { dr, cr, diff: dr - cr };
}

/** 注入稳定行键，满足 DataTable `{ id: string }` 契约。 */
function toRows(entries: JournalEntry[] | undefined, prefix: string): JournalEntryRow[] {
  return (entries ?? []).map((e, i) => ({ ...e, id: `${prefix}-${i}` }));
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * RealTimeReconLogModal — 对账日志只读抽屉（迁移自 td-manage
 * `reconciliation/real-time/ReconLogModal.tsx`，573 行）。
 *
 * 调 `useTxReconLogQuery(reconciliationTxId)` 回显四区：Recon Info /
 * Original Entry / On-chain Details / Suspense Entries / Processing Info，
 * 全部只读。分录用 `ReconciliationDrawerCard` + `InfoItem` + `DataTable`，
 * 哈希/地址/交易号用 `CopyableEllipsisText`（内置复制 toast，R5）。
 */
export function RealTimeReconLogModal({
  open,
  reconciliationTxId,
  unmatchedType,
  onOpenChange,
}: RealTimeReconLogModalProps) {
  const t = useTranslations('modules.reconciliation');

  const result = useTxReconLogQuery(reconciliationTxId, open);
  const log = result.data;

  // ── 分录表列工厂（Original / Suspense / Suggested 共用） ─────────────────────
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

  // ── 行数据（注入 id） ─────────────────────────────────────────────────────────
  const originalRows = React.useMemo(
    () => toRows(log?.originalEntry?.entries, 'orig'),
    [log?.originalEntry?.entries],
  );
  const suspenseRows = React.useMemo(
    () => toRows(log?.suspenseEntries?.entries, 'susp'),
    [log?.suspenseEntries?.entries],
  );

  // ── Dr/Cr 合计 ────────────────────────────────────────────────────────────────
  const originalTotals = React.useMemo(
    () => computeTotals(log?.originalEntry?.entries ?? []),
    [log?.originalEntry?.entries],
  );
  const suspenseTotals = React.useMemo(
    () => computeTotals(log?.suspenseEntries?.entries ?? []),
    [log?.suspenseEntries?.entries],
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
            <ReconLogBody
              log={log}
              unmatchedType={unmatchedType}
              entryColumns={entryColumns}
              originalRows={originalRows}
              suspenseRows={suspenseRows}
              originalTotals={originalTotals}
              suspenseTotals={suspenseTotals}
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

// ── 主体（拆出便于骨架/错误态早返） ─────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'modules.reconciliation'>>;

interface ReconLogBodyProps {
  log: TxReconLogRespVo;
  unmatchedType?: number;
  entryColumns: ColumnDef<JournalEntryRow>[];
  originalRows: JournalEntryRow[];
  suspenseRows: JournalEntryRow[];
  originalTotals: { dr: number; cr: number; diff: number };
  suspenseTotals: { dr: number; cr: number; diff: number };
  t: TFunc;
}

function ReconLogBody({
  log,
  unmatchedType,
  entryColumns,
  originalRows,
  suspenseRows,
  originalTotals,
  suspenseTotals,
  t,
}: ReconLogBodyProps) {
  const onchain = log.onchainDetails;
  const suspense = log.suspenseEntries;
  const statusKey = getReconStatusKey(log.reconciliationStatus);
  const resultKey = getUnmatchedTypeKey(unmatchedType);

  return (
    <>
      {/* ── Recon Info ───────────────────────────────────────────────────────── */}
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
              {statusKey
                ? (t(statusKey as never) ?? EMPTY_FIELD_VALUE)
                : EMPTY_FIELD_VALUE}
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

      {/* ── Original Entry ────────────────────────────────────────────────────── */}
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

      {/* ── On-chain Details ──────────────────────────────────────────────────── */}
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

      {/* ── Suspense Entries ──────────────────────────────────────────────────── */}
      <ReconciliationDrawerCard title={t('reconciliation_0119')}>
        {suspense ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <InfoItem label={t('reconciliation_0044')}>
                {suspense.exceptionContext || EMPTY_FIELD_VALUE}
              </InfoItem>
              <InfoItem label={t('reconciliation_0131')}>
                {suspense.processedBy || EMPTY_FIELD_VALUE}
              </InfoItem>
              <InfoItem label={t('reconciliation_0132')}>
                {formatTimestamp(suspense.processedTime)}
              </InfoItem>
            </div>
            <DataTable
              columns={entryColumns}
              data={suspenseRows}
              emptyMessage={t('reconciliation_0116')}
            />
            <TotalsBar totals={suspenseTotals} t={t} />
          </>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('reconciliation_0116')}
          </p>
        )}
      </ReconciliationDrawerCard>

      {/* ── Processing Info ───────────────────────────────────────────────────── */}
      <ReconciliationDrawerCard title={t('reconciliation_0109')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <InfoItem label={t('reconciliation_0136')}>
            <StatusBadge tone={RECON_STATUS_TONE[log.reconciliationStatus]}>
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
          <InfoItem label={t('reconciliation_0131')}>
            {suspense?.processedBy || EMPTY_FIELD_VALUE}
          </InfoItem>
          <InfoItem label={t('reconciliation_0132')}>
            {formatTimestamp(suspense?.processedTime)}
          </InfoItem>
        </div>
      </ReconciliationDrawerCard>
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
