'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '@myorg/shared/ui';
import {
  InfoItem,
  ReconciliationDrawerCard,
} from '@myorg/modules/reconciliation/ui';
import {
  type AccountBrief,
  type JournalEntry,
  useLeafAccountsQuery,
  usePostTokenSuspenseMutation,
  useTxReconLogQuery,
} from '@myorg/modules/reconciliation/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatTimestamp,
  getTxTypeKey,
} from '@myorg/modules/reconciliation/util';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIRECTION_DEBIT = 1;
const DIRECTION_CREDIT = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostToSuspenseModalProps {
  open: boolean;
  reconciliationTxId: number | undefined;
  /** financeBookId 用于获取末级科目下拉。缺失时 account select 不启用。 */
  financeBookId?: number;
  onOpenChange: (open: boolean) => void;
}

interface EditableEntry {
  id: string;
  accountCode: string;
  accountName: string;
  direction: number;
  amount: number | null;
  tokenCount?: number | null;
  tokenSymbol?: string | null;
  transactionId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAccountOptions(accounts: AccountBrief[] | undefined) {
  return (accounts ?? []).map((a) => ({
    value: a.accountCode,
    label: `${a.accountCode} ${a.accountName}`,
    name: a.accountName,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PostToSuspenseModal({
  open,
  reconciliationTxId,
  financeBookId,
  onOpenChange,
}: PostToSuspenseModalProps) {
  const t = useTranslations('modules.reconciliation');

  // ── Data ──────────────────────────────────────────────────────────────────
  const logResult = useTxReconLogQuery(reconciliationTxId, open);
  const leafResult = useLeafAccountsQuery(
    financeBookId,
    open && Boolean(financeBookId),
  );
  const log = logResult.data;

  const mutation = usePostTokenSuspenseMutation();

  // ── Form state ────────────────────────────────────────────────────────────
  const [exceptionContext, setExceptionContext] = React.useState('');

  // ── Editable entries state ────────────────────────────────────────────────
  const [entries, setEntries] = React.useState<EditableEntry[]>([]);
  const initializedRef = React.useRef<number | undefined>(undefined);

  // On open, initialize from backend suggestedSuspenseEntries.
  React.useEffect(() => {
    if (!open) {
      initializedRef.current = undefined;
      setEntries([]);
      setExceptionContext('');
      return;
    }

    if (logResult.isLoading) return;
    if (initializedRef.current === reconciliationTxId) return;

    const suggested = log?.suggestedSuspenseEntries ?? [];
    setEntries(
      suggested.map((e) => ({
        id: crypto.randomUUID(),
        accountCode: e.accountCode ?? '',
        accountName: e.accountName ?? '',
        direction: e.direction ?? DIRECTION_DEBIT,
        amount: e.amount ?? null,
        tokenCount: e.tokenCount,
        tokenSymbol: e.tokenSymbol,
        transactionId: e.transactionId,
      })),
    );
    setExceptionContext(log?.suspenseEntries?.exceptionContext ?? '');
    initializedRef.current = reconciliationTxId;
  }, [open, reconciliationTxId, logResult.isLoading, log]);

  // ── Dr/Cr totals ──────────────────────────────────────────────────────────
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
  const diff = Number((drTotal - crTotal).toFixed(2));
  const balanced = diff === 0;

  const canConfirm =
    balanced &&
    exceptionContext.trim().length > 0 &&
    entries.length > 0 &&
    entries.every(
      (e) => e.accountCode && e.amount != null && Number(e.amount) > 0,
    );

  // ── Account options ──────────────────────────────────────────────────────
  const debitOptions = React.useMemo(
    () => buildAccountOptions(leafResult.data?.debitAccounts),
    [leafResult.data?.debitAccounts],
  );
  const creditOptions = React.useMemo(
    () => buildAccountOptions(leafResult.data?.creditAccounts),
    [leafResult.data?.creditAccounts],
  );

  const getAccountOptions = (direction: number) =>
    direction === DIRECTION_DEBIT ? debitOptions : creditOptions;

  // ── Entry handlers ────────────────────────────────────────────────────────
  const addRow = React.useCallback((direction: number) => {
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        accountCode: '',
        accountName: '',
        direction,
        amount: null,
      },
    ]);
  }, []);

  const deleteRow = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAccountChange = React.useCallback(
    (id: string, accountCode: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const options = getAccountOptions(entry.direction);
      const option = options.find((o) => o.value === accountCode);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, accountCode, accountName: option?.name ?? '' }
            : e,
        ),
      );
    },
    [entries],
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = React.useCallback(() => {
    if (!reconciliationTxId) return;

    if (!exceptionContext.trim()) {
      toast.error(t('reconciliation_0120'));
      return;
    }

    if (!balanced) {
      toast.error(t('reconciliation_0121'));
      return;
    }

    const payload = {
      reconciliationTxId,
      postingDate: new Date().toISOString().split('T')[0],
      exceptionContext: exceptionContext.trim(),
      suspenseEntries: entries.map(
        (entry): JournalEntry => ({
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          direction: entry.direction,
          amount: entry.amount ?? 0,
          tokenCount: entry.tokenCount ?? undefined,
          tokenSymbol: entry.tokenSymbol ?? undefined,
          transactionId: entry.transactionId,
        }),
      ),
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('reconciliation_0264'));
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('reconciliation_0122'));
      },
    });
  }, [
    reconciliationTxId,
    exceptionContext,
    balanced,
    entries,
    mutation,
    t,
    onOpenChange,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('reconciliation_0095')}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {logResult.isLoading ? (
            <Skeleton className="h-64" />
          ) : log ? (
            <>
              {/* ── Recon Info Card ─────────────────────────────────── */}
              <ReconciliationDrawerCard title={t('reconciliation_0115')}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
                  <InfoItem
                    label={t('reconciliation_0076')}
                    value={
                      log.reconciliationTime
                        ? formatTimestamp(log.reconciliationTime)
                        : EMPTY_FIELD_VALUE
                    }
                  />
                  <InfoItem
                    label={t('reconciliation_0133')}
                    value={log.reconciliationNo || EMPTY_FIELD_VALUE}
                  />
                  <InfoItem
                    label={t('reconciliation_0055')}
                    value={
                      log.txType != null
                        ? (() => {
                            const key = getTxTypeKey(log.txType);
                            return key
                              ? t(key as never)
                              : EMPTY_FIELD_VALUE;
                          })()
                        : EMPTY_FIELD_VALUE
                    }
                  />
                  <InfoItem
                    label={t('reconciliation_0015')}
                    value={
                      log.tranId || log.txHash || EMPTY_FIELD_VALUE
                    }
                  />
                  <InfoItem
                    label={t('reconciliation_0047')}
                    value={log.financeBookName || EMPTY_FIELD_VALUE}
                  />
                  <InfoItem
                    label={t('reconciliation_0048')}
                    value={log.bookNo || EMPTY_FIELD_VALUE}
                  />
                  <InfoItem
                    label={t('reconciliation_0032')}
                    value={log.currencySymbol || EMPTY_FIELD_VALUE}
                  />
                  <InfoItem
                    label={t('reconciliation_0136')}
                    value={
                      log.reconciliationStatus != null
                        ? String(log.reconciliationStatus)
                        : EMPTY_FIELD_VALUE
                    }
                  />
                </div>
              </ReconciliationDrawerCard>

              {/* ── Suspense Entries Table ──────────────────────────── */}
              <ReconciliationDrawerCard title={t('reconciliation_0095')}>
                <div className="space-y-3">
                  {/* Add row buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(DIRECTION_DEBIT)}
                    >
                      + {t('reconciliation_0123')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(DIRECTION_CREDIT)}
                    >
                      + {t('reconciliation_0124')}
                    </Button>
                  </div>

                  {/* Entries table */}
                  {entries.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="w-10 py-2">#</th>
                          <th className="py-2">
                            {t('reconciliation_0017')}
                          </th>
                          <th className="py-2">
                            {t('reconciliation_0016')}
                          </th>
                          <th className="py-2">
                            {t('reconciliation_0040')}
                          </th>
                          <th className="w-20 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, idx) => (
                          <tr
                            key={entry.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-2 align-middle text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-2 align-middle">
                              <span>
                                {t(
                                  (entry.direction === DIRECTION_DEBIT
                                    ? 'reconciliation_0123'
                                    : 'reconciliation_0124') as never,
                                )}
                              </span>
                            </td>
                            <td className="py-2 align-middle">
                              <Select
                                value={entry.accountCode}
                                onValueChange={(v) =>
                                  handleAccountChange(entry.id, v)
                                }
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue
                                    placeholder={t('common_select')}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAccountOptions(
                                    entry.direction,
                                  ).map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 align-middle">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-[140px]"
                                value={entry.amount ?? ''}
                                placeholder="0.00"
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) => {
                                  const val = e.target.value;
                                  setEntries((prev) =>
                                    prev.map((r) =>
                                      r.id === entry.id
                                        ? {
                                            ...r,
                                            amount:
                                              val === ''
                                                ? null
                                                : Number(val),
                                          }
                                        : r,
                                    ),
                                  );
                                }}
                              />
                            </td>
                            <td className="py-2 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => deleteRow(entry.id)}
                              >
                                {t('common_delete')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('reconciliation_0116')}
                    </p>
                  )}

                  {/* Dr/Cr Total Bar */}
                  <div className="flex items-center gap-6 text-sm">
                    <span>
                      {t('reconciliation_0128')}:{' '}
                      <span className="font-semibold text-[#1677ff]">
                        {formatCurrencyValue(drTotal || null)}
                      </span>
                    </span>
                    <span>
                      {t('reconciliation_0129')}:{' '}
                      <span className="font-semibold text-[#1677ff]">
                        {formatCurrencyValue(crTotal || null)}
                      </span>
                    </span>
                    <span>
                      {t('reconciliation_0130')}:{' '}
                      <span
                        className={
                          balanced
                            ? 'font-semibold text-[#52c41a]'
                            : 'font-semibold text-[#f5222d]'
                        }
                      >
                        {formatCurrencyValue(diff || null)}
                      </span>
                    </span>
                    {!balanced && diff !== 0 ? (
                      <span className="text-xs text-destructive">
                        {t('reconciliation_0121')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </ReconciliationDrawerCard>

              {/* ── Exception Context ───────────────────────────────── */}
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
                  onChange={(
                    e: React.ChangeEvent<HTMLTextAreaElement>,
                  ) => setExceptionContext(e.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

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
      </DrawerContent>
    </Drawer>
  );
}
