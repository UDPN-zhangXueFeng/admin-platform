'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  CopyableEllipsisText,
  DataTable,
  DrawerClose,
  DrawerFooter,
  Input,
  Label,
  Textarea,
} from '@myorg/shared/ui';
import {
  InfoItem,
  ReconciliationDrawerCard,
} from '@myorg/modules/reconciliation/ui';
import {
  type JournalEntry,
  type PostSuspenseReqVo,
  type TxReconLogRespVo,
  usePostTokenSuspenseMutation,
} from '@myorg/modules/reconciliation/data-access';
import {
  DIRECTION,
  EMPTY_FIELD_VALUE,
  formatBlockHeight,
  formatCurrencyValue,
  formatNonZeroNumber,
  formatTimestamp,
  getDirectionKey,
  getTxTypeKey,
  getUnmatchedTypeKey,
} from '@myorg/modules/reconciliation/util';

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** 金额块（来自详情页行数据，用于差异标签回显）。 */
export interface AmountBlock {
  amount?: number | string | null;
  count?: number | string | null;
  currency?: string | null;
  tokenSymbol?: string | null;
}

/** DataTable 要求 `{ id: string }`；JournalEntry 无 id，注入稳定行键。 */
type EditableEntry = JournalEntry & { _rowKey: string };

type TFunc = ReturnType<typeof useTranslations<'modules.reconciliation'>>;

export interface PostToSuspenseModalContentProps {
  /** recon-log 回显数据。 */
  log: TxReconLogRespVo;
  /** Unmatched 类型（来自列表行 TxReconDetailRespVo.unmatchedType，作 fallback）。 */
  unmatchedType?: number;
  /** 链上金额块（On-chain amount 回显）。 */
  postedAmount?: AmountBlock;
  /** 差异金额块（chainAmount − financeAmount，差异标签主体）。 */
  mismatchedAmount?: AmountBlock;
  /** 提交成功 / 取消时关闭抽屉（shell 控制刷新：mutation onSuccess 已使列表失效）。 */
  onClose: () => void;
}

// ── 纯函数 helpers（迁移自源码 PostToSuspenseModal.tsx） ──────────────────────

/** Original Entry 数据是否有效。 */
function hasOriginalData(original?: TxReconLogRespVo['originalEntry']): boolean {
  return Boolean(
    original &&
      (original.tranId ||
        original.postingDate ||
        (original.entries && original.entries.length > 0)),
  );
}

/** On-chain Details 数据是否有效（含外部 txHash 兜底）。 */
function hasOnchainData(
  onchain?: TxReconLogRespVo['onchainDetails'],
  txHash?: string,
): boolean {
  return Boolean(
    onchain &&
      (onchain.blockHeight ||
        onchain.fromAddress ||
        onchain.toAddress ||
        onchain.amount != null ||
        onchain.tokenCount != null ||
        onchain.txTime ||
        onchain.hash ||
        txHash),
  );
}

/** Suspense Entries（建议分录）数据是否有效。 */
function hasSuspenseData(entries: EditableEntry[]): boolean {
  return entries.length > 0;
}

/**
 * 推断展示用 unmatched 类型（运行时按数据存在性，非 props 直读）。
 *
 * 迁移自源码 `resolveDisplayUnmatchedType`：
 * - 无 original → 2
 * - 无 onchain → 1
 * - 有 suspense → 3
 * - 否则 → fallbackType（来自行 unmatchedType）
 */
function resolveDisplayUnmatchedType(params: {
  original?: TxReconLogRespVo['originalEntry'];
  onchain?: TxReconLogRespVo['onchainDetails'];
  txHash?: string;
  entries: EditableEntry[];
  fallbackType?: number;
}): number | undefined {
  if (!hasOriginalData(params.original)) return 2;
  if (!hasOnchainData(params.onchain, params.txHash)) return 1;
  if (hasSuspenseData(params.entries)) return 3;
  return params.fallbackType;
}

/** 行键自增序列（前端编辑用稳定 key，与源码 `nextRowKey` 等价）。 */
let rowSeq = 0;
const nextRowKey = () => `ps_${Date.now()}_${++rowSeq}`;

/**
 * 将后端建议分录映射为可回显行（注入 _rowKey）。
 * 迁移自源码 `mapSuggestedSuspenseEntries`。建议分录只读，不可手增。
 */
function mapSuggestedSuspenseEntries(
  suggestedEntries?: JournalEntry[],
): EditableEntry[] {
  return (suggestedEntries ?? []).map((entry) => ({
    ...entry,
    _rowKey: nextRowKey(),
  }));
}

/**
 * 取默认记账日期（YYYY-MM-DD）：优先挂账回显 postingDate，其次原始分录 postingDate，
 * 否则今天。迁移自源码 `getDefaultPostDate`。返回 ISO 日期串（与原生 date input 兼容）。
 */
function getDefaultPostDate(log?: TxReconLogRespVo): string {
  const ts =
    log?.suspenseEntries?.postingDate ?? log?.originalEntry?.postingDate;
  if (ts) {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * 记账日期 → UTC epoch（毫秒）。迁移自源码 `toPostingDateEpoch`：
 * `Date.parse('YYYY-MM-DD' + 'T00:00:00.000Z')`，NaN 兜底用原值。
 */
function toPostingDateEpoch(date: string): number {
  const millis = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(millis) ? Date.parse(date) : millis;
}

/** Dr/Cr 合计与差额。 */
function computeTotals(entries: EditableEntry[]): {
  dr: number;
  cr: number;
  diff: number;
} {
  let dr = 0;
  let cr = 0;
  for (const e of entries) {
    if (e.direction === DIRECTION.DEBIT) dr += Number(e.amount ?? 0);
    else if (e.direction === DIRECTION.CREDIT) cr += Number(e.amount ?? 0);
  }
  return { dr, cr, diff: Number((dr - cr).toFixed(2)) };
}

// ── 差异标签（源码 unmatchedTypeTag） ──────────────────────────────────────────

/**
 * 红色差异标签：unmatched 类型文案 + 差异金额 / token 数。
 * 迁移自源码 `unmatchedTypeTag`（1/2/3 → 仅系统有 / 仅链上有 / 金额不匹配）。
 *
 * 目标侧统一走 util `unmatched_type_${n}`（与 reconciliation_0112/0113/0114 同文案）。
 */
function UnmatchedTypeTag({
  t,
  type,
  amount,
  currencySymbol,
  tokenAmount,
  tokenSymbol,
}: {
  t: TFunc;
  type?: number;
  amount?: number | string | null;
  currencySymbol?: string | null;
  tokenAmount?: number | string | null;
  tokenSymbol?: string | null;
}) {
  const key = getUnmatchedTypeKey(type);
  if (!key) return null;
  const amountText = formatCurrencyValue(
    amount == null ? null : Number(amount),
  );
  const tokenText = formatNonZeroNumber(
    tokenAmount == null ? null : Number(tokenAmount),
  );
  const hasAmount = amountText !== EMPTY_FIELD_VALUE;
  const hasToken = tokenText !== EMPTY_FIELD_VALUE;
  return (
    <div className="inline-flex flex-col gap-0.5 rounded bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
      <span>{t(key as never)}</span>
      {hasAmount ? (
        <span className="font-semibold">
          {amountText}
          {currencySymbol ? ` ${currencySymbol}` : ''}
        </span>
      ) : null}
      {hasToken ? (
        <span className="font-semibold">
          ({tokenText}
          {tokenSymbol ? ` ${tokenSymbol}` : ''})
        </span>
      ) : null}
    </div>
  );
}

// ── 行数据注入 ────────────────────────────────────────────────────────────────

/** 注入稳定行键，满足 DataTable `{ id: string }` 契约（Original 表）。 */
function toOriginalRows(
  entries?: JournalEntry[],
): (JournalEntry & { id: string })[] {
  return (entries ?? []).map((e, i) => ({ ...e, id: `orig-${i}` }));
}

/** EditableEntry → DataTable 行（id=_rowKey）。 */
function toSuspenseRows(
  entries: EditableEntry[],
): (EditableEntry & { id: string })[] {
  return entries.map((e) => ({ ...e, id: e._rowKey }));
}

// ── 主体 ──────────────────────────────────────────────────────────────────────

/**
 * PostToSuspenseModalContent — Token 挂账抽屉主体（已从 shell 拆出，
 * 便于骨架/错误态早返，避免 nx 对超大文件的 lazy 误报）。
 *
 * 对照源码 `reconciliation/real-time/PostToSuspenseModal.tsx`（767 行）补全：
 * - `resolveDisplayUnmatchedType`：运行时按 original/onchain/suspense 存在性推断类型；
 * - `mapSuggestedSuspenseEntries`：后端建议分录只读回显（注入 _rowKey，前端不可新增/编辑）；
 * - `toPostingDateEpoch`：记账日期转 UTC epoch 提交；
 * - `canConfirm`：balanced && postDate && exceptionContext.trim() && 每行 accountCode && amount>0；
 * - `unmatchedTypeTag`：1/2/3 红色差异标签 + 借贷汇总 drTotal/crTotal/diff。
 *
 * footer（Cancel/Confirm）由本组件渲染：提交逻辑与按钮状态（canConfirm/submitting）
 * 共享同一份 state，避免 shell/content 间状态重复或 context 桥接。
 */
export function PostToSuspenseModalContent({
  log,
  unmatchedType,
  postedAmount,
  mismatchedAmount,
  onClose,
}: PostToSuspenseModalContentProps) {
  const t = useTranslations('modules.reconciliation');

  // ── 表单状态 ──────────────────────────────────────────────────────────────
  const [entries, setEntries] = React.useState<EditableEntry[]>([]);
  const [postDate, setPostDate] = React.useState<string>(
    getDefaultPostDate(log),
  );
  const [exceptionContext, setExceptionContext] = React.useState('');

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = usePostTokenSuspenseMutation();

  // ── 打开时用后端建议分录回显（只读，不可手增） ──────────────────────────────
  React.useEffect(() => {
    setEntries(mapSuggestedSuspenseEntries(log.suggestedSuspenseEntries));
    setPostDate(getDefaultPostDate(log));
    setExceptionContext('');
  }, [log]);

  // ── Dr/Cr 合计 ────────────────────────────────────────────────────────────
  const totals = React.useMemo(() => computeTotals(entries), [entries]);
  const balanced = totals.diff === 0;

  const canConfirm =
    balanced &&
    postDate.trim().length > 0 &&
    exceptionContext.trim().length > 0 &&
    entries.length > 0 &&
    entries.every(
      (e) => e.accountCode && e.amount != null && Number(e.amount) > 0,
    );

  // ── 展示类型推断 ──────────────────────────────────────────────────────────
  const original = log.originalEntry;
  const onchain = log.onchainDetails;
  const displayUnmatchedType = resolveDisplayUnmatchedType({
    original,
    onchain,
    txHash: log.txHash,
    entries,
    fallbackType: unmatchedType,
  });

  // ── Original / Suspense 只读列 ─────────────────────────────────────────────
  const originalColumns = React.useMemo<
    ColumnDef<JournalEntry & { id: string }>[]
  >(
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
            {row.original.accountName ? ` ${row.original.accountName}` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('reconciliation_0040'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrencyValue(row.original.amount)}
            {log.currencySymbol ? ` ${log.currencySymbol}` : ''}
          </span>
        ),
      },
    ],
    [t, log.currencySymbol],
  );

  const suspenseColumns = React.useMemo<
    ColumnDef<EditableEntry & { id: string }>[]
  >(
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
            {row.original.accountName ? ` ${row.original.accountName}` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('reconciliation_0040'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrencyValue(row.original.amount)}
            {log.currencySymbol ? ` ${log.currencySymbol}` : ''}
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
    [t, log.currencySymbol],
  );

  // ── 提交 ──────────────────────────────────────────────────────────────────
  const handleSubmit = React.useCallback(() => {
    if (!exceptionContext.trim()) {
      toast.error(t('reconciliation_0120'));
      return;
    }
    if (!postDate.trim()) {
      toast.error(t('reconciliation_0039'));
      return;
    }
    if (!balanced) {
      toast.error(t('reconciliation_0121'));
      return;
    }

    const payload: PostSuspenseReqVo = {
      reconciliationTxId: log.reconciliationTxId,
      postingDate: String(toPostingDateEpoch(postDate)),
      exceptionContext: exceptionContext.trim(),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      suspenseEntries: entries.map(({ _rowKey, ...rest }) => rest),
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        // 源码 code===0 → message.success + onSuccess 刷新 + onClose。
        // mutation hook 已使 recon-log / tx-list / tx-investigation 失效（等价刷新）。
        toast.success(t('reconciliation_0264'));
        onClose();
      },
      onError: () => {
        toast.error(t('reconciliation_0122'));
      },
    });
  }, [
    exceptionContext,
    postDate,
    balanced,
    log.reconciliationTxId,
    entries,
    mutation,
    t,
    onClose,
  ]);

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* ── Recon Info（8 格 KV + unmatchedType 红色差异标签） ──────────────── */}
        <ReconciliationDrawerCard title={t('reconciliation_0115')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <InfoItem label={t('reconciliation_0076')}>
              {formatTimestamp(log.reconciliationTime)}
            </InfoItem>
            <InfoItem label={t('reconciliation_0133')}>
              <CopyableEllipsisText
                value={log.reconciliationNo}
                copyLabel={t('common_copy')}
                className="max-w-[200px]"
              />
            </InfoItem>
            <InfoItem label={t('reconciliation_0055')}>
              {getTxTypeKey(log.txType)
                ? (t(getTxTypeKey(log.txType) as never) ?? EMPTY_FIELD_VALUE)
                : EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0015')}>
              <CopyableEllipsisText
                value={log.tranId ?? log.txHash}
                copyLabel={t('common_copy')}
                className="max-w-[200px]"
              />
            </InfoItem>
            <InfoItem label={t('reconciliation_0047')}>
              {log.financeBookName || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0048')}>
              {log.bookNo || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0032')}>
              {log.currencySymbol || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label=" " className="flex items-end">
              <UnmatchedTypeTag
                t={t}
                type={displayUnmatchedType}
                amount={mismatchedAmount?.amount}
                currencySymbol={
                  mismatchedAmount?.currency ?? log.currencySymbol
                }
                tokenAmount={mismatchedAmount?.count}
                tokenSymbol={mismatchedAmount?.tokenSymbol}
              />
            </InfoItem>
          </div>
        </ReconciliationDrawerCard>

        {/* ── Original Entry（只读） ────────────────────────────────────────── */}
        <ReconciliationDrawerCard title={t('reconciliation_0035')}>
          <DataTable
            columns={originalColumns}
            data={toOriginalRows(original?.entries)}
            emptyMessage={t('reconciliation_0116')}
          />
        </ReconciliationDrawerCard>

        {/* ── On-chain Details（只读，仅 hasOnchainData 渲染） ───────────────── */}
        {hasOnchainData(onchain, log.txHash) ? (
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
                  {formatCurrencyValue(
                    postedAmount?.amount != null
                      ? Number(postedAmount.amount)
                      : (onchain?.amount ?? null),
                  )}
                  {log.currencySymbol ? ` ${log.currencySymbol}` : ''}
                </span>
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
              <InfoItem
                label={t('reconciliation_0058')}
                className="sm:col-span-2"
              >
                <CopyableEllipsisText
                  value={onchain?.hash ?? log.txHash}
                  copyLabel={t('common_copy')}
                  className="max-w-[480px]"
                />
              </InfoItem>
            </div>
          </ReconciliationDrawerCard>
        ) : null}

        {/* ── Suspense Entries（建议分录只读回显 + postingDate） ────────────── */}
        <ReconciliationDrawerCard title={t('reconciliation_0095')}>
          <div className="space-y-3">
            <div className="max-w-[320px] space-y-1.5">
              <Label htmlFor="post-date">
                {t('reconciliation_0039')}
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="post-date"
                type="date"
                value={postDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPostDate(e.target.value)
                }
              />
            </div>
            <DataTable
              columns={suspenseColumns}
              data={toSuspenseRows(entries)}
              emptyMessage={t('reconciliation_0116')}
            />
            {/* 借贷平衡汇总（drTotal / crTotal / diff，balanced 着色） */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 pt-1 text-sm text-muted-foreground">
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
                <span
                  className={
                    balanced
                      ? 'font-semibold tabular-nums text-green-600'
                      : 'font-semibold tabular-nums text-red-600'
                  }
                >
                  {formatCurrencyValue(totals.diff)}
                </span>
              </span>
              {!balanced ? (
                <Badge variant="destructive">
                  {t('reconciliation_0121')}
                </Badge>
              ) : null}
            </div>
          </div>
        </ReconciliationDrawerCard>

        {/* ── Exception Context（必填，maxLength 200） ─────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="exception-context">
            {t('reconciliation_0044')}
            <span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Textarea
            id="exception-context"
            value={exceptionContext}
            maxLength={200}
            rows={3}
            placeholder={t('reconciliation_0120')}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setExceptionContext(e.target.value)
            }
          />
        </div>
      </div>

      {/* ── footer（Cancel / Confirm）：状态与提交逻辑同源 ────────────────────── */}
      <DrawerFooter className="border-t">
        <DrawerClose asChild>
          <Button variant="outline">{t('common_cancel')}</Button>
        </DrawerClose>
        <Button
          onClick={handleSubmit}
          disabled={!canConfirm || mutation.isPending}
        >
          {t('PUB_Confirm')}
        </Button>
      </DrawerFooter>
    </>
  );
}
