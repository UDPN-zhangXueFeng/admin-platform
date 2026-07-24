'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  CopyableEllipsisText,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  DataTable,
} from '@myorg/shared/ui';
import {
  InfoItem,
  ReconciliationDrawerCard,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';
import {
  useReserveReconLogQuery,
  useLeafAccountsQuery,
  usePostReserveSuspenseMutation,
  type JournalEntry,
  type AccountBrief,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatTimestamp,
  RESERVE_STATUS_TONE,
  getReserveStatusKey,
  getReserveTypeKey,
} from '@myorg/modules/reconciliation/util';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';

// ── 常量 ────────────────────────────────────────────────────────────────────────

const DIRECTION_DEBIT = 1;
const DIRECTION_CREDIT = 2;

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReservePostToSuspenseModalContentProps {
  reconciliationReserveId: number | undefined;
  /** 末级科目接口入参（使用 reserve detail context 中的 financeBookId / bookNo）。 */
  financeBookId?: number;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ── 类型 ──────────────────────────────────────────────────────────────────────

interface EditableEntry extends JournalEntry {
  /** 前端编辑用临时行键。 */
  _rowKey: string;
  /**
   * 行内可编辑的交易参考（占位输入，仅前端展示）。
   * 后端 JournalEntry 暂无该字段，提交时不发送（见 handleSubmit payload 剥离）。
   * 对齐源码 td-manage `_txRef`。
   */
  _txRef?: string;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * ReservePostToSuspenseModalContent — 储备挂账抽屉内容（不含 Drawer 外壳）。
 *
 * 由 `reserve-post-to-suspense-modal.tsx`（Drawer 外壳）渲染。拆 content 以规避
 * nx 对超大 lazy 组件的误报（参照 journal-entries 经验）。
 *
 * - 回显 ReserveReconLog + 末级科目（跨域 tx/accounts/leaf）
 * - Dr/Cr 可增减行 + 科目下拉（动态 debitAccounts|creditAccounts）+ 金额输入
 *   + 交易参考占位输入（_txRef，不提交）+ 删除
 * - 平衡校验 + Exception Context 必填
 * - 使用 usePostReserveSuspenseMutation 提交
 *
 * ⚠️ R1: 后端 reserve 挂账端点尚未就绪，此组件实现但不接入详情页。
 */
export function ReservePostToSuspenseModalContent({
  reconciliationReserveId,
  financeBookId,
  onOpenChange,
  onSuccess,
}: ReservePostToSuspenseModalContentProps) {
  const t = useTranslations('modules.reconciliation');
  const mutation = usePostReserveSuspenseMutation();

  // ── 回显数据 ──────────────────────────────────────────────────────────────
  const { data: logData, isLoading: logLoading } = useReserveReconLogQuery(
    reconciliationReserveId,
    true,
  );

  const effectiveFinanceBookId = financeBookId ?? logData?.financeBookId;
  const { data: leafAccounts } = useLeafAccountsQuery(
    effectiveFinanceBookId,
    effectiveFinanceBookId != null,
  );

  const debitAccounts = React.useMemo<AccountBrief[]>(
    () => leafAccounts?.debitAccounts ?? [],
    [leafAccounts],
  );
  const creditAccounts = React.useMemo<AccountBrief[]>(
    () => leafAccounts?.creditAccounts ?? [],
    [leafAccounts],
  );

  // ── 编辑状态 ──────────────────────────────────────────────────────────────
  const [entries, setEntries] = React.useState<EditableEntry[]>([]);
  const [exceptionContext, setExceptionContext] = React.useState('');

  // ── 打开时初始化两行 Dr/Cr 空白（非后端建议，留作后续优化） ──────────────
  React.useEffect(() => {
    setEntries([
      {
        _rowKey: crypto.randomUUID(),
        direction: DIRECTION_DEBIT,
        accountCode: undefined as unknown as string,
        accountName: undefined,
        amount: 0,
        tokenCount: undefined,
        tokenSymbol: undefined,
        transactionId: undefined,
      },
      {
        _rowKey: crypto.randomUUID(),
        direction: DIRECTION_CREDIT,
        accountCode: undefined as unknown as string,
        accountName: undefined,
        amount: 0,
        tokenCount: undefined,
        tokenSymbol: undefined,
        transactionId: undefined,
      },
    ]);
    setExceptionContext('');
  }, [reconciliationReserveId]);

  const updateEntry = (rowKey: string, patch: Partial<EditableEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e._rowKey === rowKey ? { ...e, ...patch } : e)),
    );
  };

  const drTotal = React.useMemo(
    () =>
      entries
        .filter((e) => e.direction === DIRECTION_DEBIT)
        .reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [entries],
  );
  const crTotal = React.useMemo(
    () =>
      entries
        .filter((e) => e.direction === DIRECTION_CREDIT)
        .reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [entries],
  );
  const diff = React.useMemo(
    () => Number((drTotal - crTotal).toFixed(2)),
    [drTotal, crTotal],
  );
  const balanced = diff === 0;
  const canConfirm =
    balanced &&
    exceptionContext.trim().length > 0 &&
    entries.length > 0 &&
    entries.every(
      (e) =>
        e.accountCode &&
        e.amount != null &&
        Number(e.amount) > 0 &&
        e.direction != null,
    );

  // ── 提交 ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!reconciliationReserveId) return;
    if (!exceptionContext.trim()) {
      toast.warning(t('reconciliation_0120'));
      return;
    }
    if (!balanced) {
      toast.warning(t('reconciliation_0121'));
      return;
    }

    const payload = {
      reconciliationReserveId,
      exceptionContext: exceptionContext.trim(),
      // _rowKey/_txRef 为前端临时态，提交时剥离（对齐源码 td-manage）。
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      suspenseEntries: entries.map(({ _rowKey, _txRef, ...rest }) => rest),
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('PUB_Success'));
        onSuccess?.();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('reconciliation_0122'));
      },
    });
  };

  // ── 分录表列（5 列：direction / accountCode / amount / _txRef / 删除） ──────
  const entryColumns = React.useMemo<ColumnDef<EditableEntry>[]>(
    () => [
      {
        accessorKey: 'direction',
        header: t('reconciliation_0017'),
        cell: ({ row }) => (
          <Select
            value={String(row.original.direction ?? '')}
            onValueChange={(v) =>
              updateEntry(row.original._rowKey, {
                direction: Number(v),
                accountCode: undefined as unknown as string,
                accountName: undefined,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('reconciliation_0125')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(DIRECTION_DEBIT)}>
                {t('reconciliation_0123')}
              </SelectItem>
              <SelectItem value={String(DIRECTION_CREDIT)}>
                {t('reconciliation_0124')}
              </SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        id: 'account',
        header: t('reconciliation_0016'),
        cell: ({ row }) => {
          const opts =
            row.original.direction === DIRECTION_DEBIT
              ? debitAccounts
              : creditAccounts;
          return (
            <Select
              value={row.original.accountCode ?? ''}
              onValueChange={(v) => {
                const found = opts.find((a) => a.accountCode === v);
                updateEntry(row.original._rowKey, {
                  accountCode: v,
                  accountName: found?.accountName,
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('reconciliation_0125')} />
              </SelectTrigger>
              <SelectContent>
                {opts.map((a) => (
                  <SelectItem key={a.accountCode} value={a.accountCode ?? ''}>
                    {[a.accountCode, a.accountName].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: t('reconciliation_0040'),
        cell: ({ row }) => (
          <Input
            type="number"
            min={0}
            step={0.01}
            value={row.original.amount ?? ''}
            onChange={(e) =>
              updateEntry(row.original._rowKey, {
                amount: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="tabular-nums"
          />
        ),
      },
      {
        // 交易参考占位输入（仅前端展示，提交时剥离，对齐源码 _txRef）。
        accessorKey: '_txRef',
        header: t('reconciliation_0015'),
        cell: ({ row }) => (
          <Input
            value={row.original._txRef ?? ''}
            onChange={(e) =>
              updateEntry(row.original._rowKey, { _txRef: e.target.value })
            }
          />
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            onClick={() =>
              setEntries((prev) =>
                prev.filter((e) => e._rowKey !== row.original._rowKey),
              )
            }
          >
            {t('reconciliation_0126')}
          </Button>
        ),
      },
    ],
    [t, debitAccounts, creditAccounts],
  );

  // ── 回显中的计算数据 ──────────────────────────────────────────────────────
  const info = logData;
  const mc = info?.mintableCapacity;
  const ae = info?.actualExecution;
  const tr = info?.transactionRequest;

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {logLoading ? (
          <div className="h-96 w-full animate-pulse rounded bg-muted" />
        ) : (
          <>
            {/* Recon Info */}
            <ReconciliationDrawerCard
              title={t('reconciliation_0115')}
              extra={
                <StatusBadge
                  tone={RESERVE_STATUS_TONE[info?.reconciliationStatus]}
                >
                  {getReserveStatusKey(info?.reconciliationStatus)
                    ? (t(
                        getReserveStatusKey(
                          info?.reconciliationStatus,
                        ) as never,
                      ) ?? EMPTY_FIELD_VALUE)
                    : EMPTY_FIELD_VALUE}
                </StatusBadge>
              }
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                <InfoItem label={t('reconciliation_0076')}>
                  {formatTimestamp(info?.reconciliationTime)}
                </InfoItem>
                <InfoItem label={t('reconciliation_0133')}>
                  <CopyableEllipsisText
                    value={info?.reconciliationNo}
                    copyLabel={t('common_copy')}
                    className="max-w-[180px]"
                  />
                </InfoItem>
                <InfoItem label={t('reconciliation_0055')}>
                  {info?.txType != null
                    ? (t(getReserveTypeKey(info.txType) as never) ??
                      EMPTY_FIELD_VALUE)
                    : EMPTY_FIELD_VALUE}
                </InfoItem>
                <InfoItem label={t('reconciliation_0015')}>
                  <CopyableEllipsisText
                    value={info?.txHash}
                    copyLabel={t('common_copy')}
                    className="max-w-[200px]"
                  />
                </InfoItem>
                <InfoItem label={t('reconciliation_0047')}>
                  {info?.financeBookName || EMPTY_FIELD_VALUE}
                </InfoItem>
                <InfoItem label={t('reconciliation_0048')}>
                  <CopyableEllipsisText
                    value={String(info?.financeBookId ?? '')}
                    copyLabel={t('common_copy')}
                    className="max-w-[160px]"
                  />
                </InfoItem>
                <InfoItem label={t('reconciliation_0032')}>
                  {info?.currencySymbol || EMPTY_FIELD_VALUE}
                </InfoItem>
              </div>
            </ReconciliationDrawerCard>

            {/* Mintable Capacity（Reserve 独有） */}
            {mc ? (
              <ReconciliationDrawerCard title={t('reconciliation_0215')}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                  <InfoItem label={t('reconciliation_0215')}>
                    {mc.mintableCapacity != null
                      ? `${mc.mintableCapacity} ${
                          mc.mintableCapacityCurrency ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0216')}>
                    {mc.mintableCapacityToken != null
                      ? `${mc.mintableCapacityToken} ${
                          mc.mintableCapacityTokenSymbol ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0217')}>
                    {formatTimestamp(mc.snapshotTime)}
                  </InfoItem>
                </div>
              </ReconciliationDrawerCard>
            ) : null}

            {/* Actual Execution（Reserve 独有） */}
            {ae ? (
              <ReconciliationDrawerCard title={t('reconciliation_0218')}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                  <InfoItem label={t('reconciliation_0219')}>
                    {ae.senderWalletAddress || EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0220')}>
                    {ae.receiverWalletAddress || EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0221')}>
                    {ae.executionAmount != null
                      ? `${ae.executionAmount} ${
                          ae.executionAmountCurrency ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0222')}>
                    {ae.executionTokenAmount != null
                      ? `${ae.executionTokenAmount} ${
                          ae.executionTokenSymbol ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0223')}>
                    {formatTimestamp(ae.executionTime)}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0224')}>
                    <CopyableEllipsisText
                      value={ae.executionTxHash}
                      copyLabel={t('common_copy')}
                      className="max-w-[200px]"
                    />
                  </InfoItem>
                </div>
              </ReconciliationDrawerCard>
            ) : null}

            {/* Transaction Request（Reserve 独有） */}
            {tr ? (
              <ReconciliationDrawerCard title={t('reconciliation_0225')}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                  <InfoItem label={t('reconciliation_0226')}>
                    {tr.meltingAmount != null
                      ? `${tr.meltingAmount} ${
                          tr.meltingAmountCurrency ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0227')}>
                    {tr.meltingTokenAmount != null
                      ? `${tr.meltingTokenAmount} ${
                          tr.meltingTokenSymbol ?? ''
                        }`.trim()
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0052')}>
                    {tr.tokenName || EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0053')}>
                    {tr.tokenType != null
                      ? String(tr.tokenType)
                      : EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('PUB_Blockchain')}>
                    {tr.blockchainName || EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0140')}>
                    {tr.createdBy || EMPTY_FIELD_VALUE}
                  </InfoItem>
                  <InfoItem label={t('reconciliation_0141')}>
                    {formatTimestamp(tr.createdTime)}
                  </InfoItem>
                </div>
              </ReconciliationDrawerCard>
            ) : null}

            {/* 可编辑 Suspense Entries（5 列） */}
            <ReconciliationDrawerCard title={t('reconciliation_0095')}>
              <div className="space-y-3">
                <DataTable
                  columns={entryColumns}
                  data={entries}
                  emptyMessage={t('reconciliation_0116')}
                />

                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() =>
                    setEntries((prev) => [
                      ...prev,
                      {
                        _rowKey: crypto.randomUUID(),
                        direction: DIRECTION_DEBIT,
                      } as EditableEntry,
                    ])
                  }
                >
                  + {t('reconciliation_0127')}
                </Button>

                {/* Dr/Cr 合计条（借贷平衡汇总） */}
                <div className="flex flex-wrap gap-x-8 gap-y-1 pt-3 text-sm text-muted-foreground">
                  <span>
                    {t('reconciliation_0128')}:{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrencyValue(drTotal)}
                    </span>
                  </span>
                  <span>
                    {t('reconciliation_0129')}:{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrencyValue(crTotal)}
                    </span>
                  </span>
                  <span>
                    {t('reconciliation_0130')}:{' '}
                    <span
                      className={
                        balanced
                          ? 'font-semibold tabular-nums text-success'
                          : 'font-semibold tabular-nums text-destructive'
                      }
                    >
                      {formatCurrencyValue(diff)}
                    </span>
                  </span>
                </div>
              </div>
            </ReconciliationDrawerCard>

            {/* Exception Context（必填） */}
            <div className="space-y-2">
              <Label>
                {t('reconciliation_0044')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Textarea
                value={exceptionContext}
                maxLength={200}
                rows={3}
                onChange={(e) => setExceptionContext(e.target.value)}
                placeholder={t('reconciliation_0120')}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t p-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('PUB_Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canConfirm}
          loading={mutation.isPending}
        >
          {t('PUB_Confirm')}
        </Button>
      </div>
    </>
  );
}
