/**
 * Chart of Accounts 详情页 EOD 数据转换。
 *
 * 1:1 迁移自源项目 `view/utils.ts` 的 EOD 部分，适配：Dayjs → date-fns +
 * epoch ms（`parseDateToMs`、`eodDateValue: number`、`getUtc8DayTimestampRange`
 * 接收 `[startMs, endMs]`）。`EodStatementRow` 注入 `id = key`。
 *
 * 时区说明：源用 dayjs `utcOffset(8)` 强制 UTC+8；这里用 date-fns 本地时区
 * `startOfDay/endOfDay` 简化（mock 数据场景可接受；接后端后若需严格 UTC+8 再换 date-fns-tz）。
 */
import { endOfDay, format, startOfDay } from 'date-fns';
import { normalizeTextValue } from '@myorg/modules/chart-of-accounts/util';
import { toSafeNumber } from './chart-of-accounts-detail.utils';
import type {
  EodAccountingStatus,
  EodBalanceRowResp,
  EodBalancesPagedResp,
  EodClearingStatus,
  EodDetailAccountRow,
  EodDetailRespVo,
  EodStatementDetail,
  EodStatementRow,
  EodSuspenseEntryRow,
  LegacyEodBalancesResp,
  LegacyEodEntryResp,
} from './chart-of-accounts-detail.model';

/** 从带符号/逗号的金额字符串解析数值（非数字剥离为 0）。 */
export function parseCurrencyAmount(value?: string): number {
  return Number(value?.replace(/[^0-9.-]/g, '') || 0);
}

/** 解析为正数；非正或非有限返回 undefined。 */
export function toPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** 解析日期（string / number / 10 或 13 位时间戳字符串）为 epoch ms；无效返回 NaN。 */
export function parseDateToMs(value?: string | number): number {
  if (value === undefined || value === null || value === '') return Number.NaN;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed) * 1000;
  return Date.parse(trimmed);
}

/** 金额格式化（2 位小数 + 可选货币码）。 */
export function formatMoneyWithCurrency(
  amount?: number,
  currencyCode?: string
): string {
  const numeric = Number(amount || 0);
  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}

/** 金额格式化，空值返回 '--'。 */
export function formatOptionalMoneyWithCurrency(
  amount: unknown,
  currencyCode?: string
): string {
  if (amount === undefined || amount === null || amount === '') return '--';
  const numeric = Number(amount);
  return Number.isFinite(numeric)
    ? formatMoneyWithCurrency(numeric, currencyCode)
    : '--';
}

/** epoch ms → 'MMM d, yyyy HH:mm:ss'，无效返回 '--'。 */
export function formatTimestamp(value?: number): string {
  if (!value || value <= 0) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return '--';
  }
}

/** epoch ms → 'MMM d, yyyy'（EOD 日期展示）。 */
function formatEodDate(ms: number): string {
  if (!Number.isFinite(ms)) return '--';
  try {
    return format(new Date(ms), 'MMM d, yyyy');
  } catch {
    return '--';
  }
}

/** 日期范围 `[startMs, endMs]` → 当天起止 ms（用于 EOD 查询 / 列表过滤）。 */
export function getUtc8DayTimestampRange(
  range: [number, number] | null
): { startDate: number; endDate: number } | undefined {
  if (!range?.[0] || !range?.[1]) return undefined;
  return {
    startDate: startOfDay(range[0]).getTime(),
    endDate: endOfDay(range[1]).getTime(),
  };
}

export function resolveEodAccountingStatus(value?: number): EodAccountingStatus {
  return value === 1 ? 'balanced' : 'unbalanced';
}

export function resolveEodClearingStatus(value?: number): EodClearingStatus {
  if (value === 1) return 'settled';
  if (value === 2) return 'suspensed';
  if (value === 3) return 'adjusted';
  if (value === 4) return 'pending';
  return 'none';
}

interface EodDetailAccountBalanceSource {
  eodAccountBalanceId?: number;
  accountCode?: string;
  accountName?: string;
  openingBalance?: number;
  debitBalance?: number;
  creditBalance?: number;
  closingBalance?: number;
}

/** EOD 明细：账户余额 → 展示行（注入 id=key）。 */
export function toEodDetailAccountRows(
  balances: EodDetailAccountBalanceSource[] = [],
  currencyCode?: string
): EodDetailAccountRow[] {
  return balances.map((item, index) => {
    const accountCode = item.accountCode?.trim();
    const accountName = item.accountName?.trim();
    const key =
      String(item.eodAccountBalanceId || '') ||
      `${accountCode || 'account'}-${index}`;

    return {
      id: key,
      key,
      accountName:
        accountCode && accountName
          ? `${accountCode} - ${accountName}`
          : accountName || accountCode || '--',
      depth: 0,
      openingSide: '--',
      opening: formatMoneyWithCurrency(item.openingBalance, currencyCode),
      debit: formatMoneyWithCurrency(item.debitBalance, currencyCode),
      credit: formatMoneyWithCurrency(item.creditBalance, currencyCode),
      closingSide: '--',
      closing: formatMoneyWithCurrency(item.closingBalance, currencyCode),
    };
  });
}

/** 从单行分页数据构建 EodStatementRow。 */
function buildRowFromPaged(
  row: EodBalanceRowResp,
  index: number,
  currencyCode: string
): EodStatementRow {
  const rowCurrencyCode = row.currencyCode || currencyCode;
  const postingDate = row.postingDate?.trim();
  const postingMs = parseDateToMs(postingDate);
  const hasValidPostingDate =
    !!postingDate && postingDate !== '0' && Number.isFinite(postingMs);
  const createdOnMs =
    row.createdOn && row.createdOn > 0 ? row.createdOn : Number.NaN;
  const eodDateValue = hasValidPostingDate
    ? postingMs
    : Number.isFinite(createdOnMs)
      ? createdOnMs
      : 0;

  const totalAssetsValue = parseCurrencyAmount(String(row.totalAssets));
  const totalLiabilitiesValue = parseCurrencyAmount(String(row.totalLiabilities));
  const varianceValue = Math.abs(totalAssetsValue - totalLiabilitiesValue);
  const financeBookEodId =
    toPositiveNumber(row.financeBookEodId) ??
    toPositiveNumber((row as unknown as { eodId?: number }).eodId);

  const key = `${postingDate || 'na'}-${index}`;

  return {
    id: key,
    key,
    financeBookEodId,
    eodDate: hasValidPostingDate ? formatEodDate(postingMs) : '--',
    eodDateValue,
    totalAssets: formatMoneyWithCurrency(totalAssetsValue, rowCurrencyCode),
    totalLiabilities: formatMoneyWithCurrency(totalLiabilitiesValue, rowCurrencyCode),
    suspenseEntries: Number.isFinite(Number(row.suspenseEntries))
      ? Number(row.suspenseEntries)
      : 0,
    variance: formatMoneyWithCurrency(varianceValue, rowCurrencyCode),
    varianceValue,
    createdOn:
      row.createdOn && row.createdOn > 0 ? formatTimestamp(row.createdOn) : '--',
    accountingStatus: resolveEodAccountingStatus(row.accountingStatus),
    clearingStatus: resolveEodClearingStatus(row.clearingStatus),
    closedBy: row.processedBy || '--',
    actionType: 'details',
  };
}

/**
 * EOD 余额响应 → 列表行（按日期降序）。
 * 支持新结构（rows 聚合）与旧结构（entries + suspenseEntries 分组计算）。
 */
export function buildEodStatementRows(
  data: EodBalancesPagedResp | LegacyEodBalancesResp | undefined,
  fallbackCurrency?: string
): EodStatementRow[] {
  if (!data) return [];

  const pagedData = data as EodBalancesPagedResp;
  if (pagedData.rows && Array.isArray(pagedData.rows)) {
    const currencyCode = pagedData.currencyCode || fallbackCurrency || '';
    return pagedData.rows
      .map((row, index) => buildRowFromPaged(row, index, currencyCode))
      .sort((a, b) => b.eodDateValue - a.eodDateValue);
  }

  const oldData = data as LegacyEodBalancesResp;
  const currencyCode = oldData.currencyCode || fallbackCurrency || '';
  const sourceEntries: LegacyEodEntryResp[] = [
    ...(oldData.entries || []),
    ...(oldData.suspenseEntries || []),
  ];

  const groupedByDate = sourceEntries.reduce<Record<string, LegacyEodEntryResp[]>>(
    (acc, entry) => {
      const postingDate = entry.postingDate?.trim();
      if (!postingDate) return acc;
      if (!acc[postingDate]) acc[postingDate] = [];
      acc[postingDate].push(entry);
      return acc;
    },
    {}
  );

  const rows: EodStatementRow[] = [];

  Object.entries(groupedByDate).forEach(([postingDate, entries], index) => {
    const postingMs = parseDateToMs(postingDate);
    if (!Number.isFinite(postingMs)) return;

    const totalAssets = entries.reduce(
      (sum, entry) => (entry.direction === 'Dr' ? sum + Number(entry.amount || 0) : sum),
      0
    );
    const totalLiabilities = entries.reduce(
      (sum, entry) => (entry.direction === 'Cr' ? sum + Number(entry.amount || 0) : sum),
      0
    );
    const varianceValue = Math.abs(totalAssets - totalLiabilities);
    const suspenseEntriesCount = (oldData.suspenseEntries || []).filter(
      (entry) => entry.postingDate?.trim() === postingDate
    ).length;
    const financeBookEodId =
      toPositiveNumber(entries[0]?.financeBookEodId) ??
      toPositiveNumber(entries[0]?.eodId);
    const key = `${postingDate}-${index}`;

    rows.push({
      id: key,
      key,
      financeBookEodId,
      eodDate: formatEodDate(postingMs),
      eodDateValue: postingMs,
      totalAssets: formatMoneyWithCurrency(totalAssets, currencyCode),
      totalLiabilities: formatMoneyWithCurrency(totalLiabilities, currencyCode),
      suspenseEntries: suspenseEntriesCount,
      variance: formatMoneyWithCurrency(varianceValue, currencyCode),
      varianceValue,
      createdOn: '--',
      accountingStatus: varianceValue === 0 ? 'balanced' : 'unbalanced',
      clearingStatus: 'none',
      closedBy: '--',
      actionType: 'details',
    });
  });

  return rows.sort((a, b) => b.eodDateValue - a.eodDateValue);
}

/** 合并相邻同 voucherId / transactionId 的暂记行（rowSpan 计算）。 */
function mergeAdjacentSuspenseEntryIds(
  rows: EodSuspenseEntryRow[]
): EodSuspenseEntryRow[] {
  const mergedRows = rows.map((row) => ({ ...row }));

  for (let startIndex = 0; startIndex < mergedRows.length; ) {
    const currentVoucherId = mergedRows[startIndex].voucherId;
    let endIndex = startIndex + 1;
    while (
      currentVoucherId &&
      currentVoucherId !== '--' &&
      endIndex < mergedRows.length &&
      mergedRows[endIndex].voucherId === currentVoucherId
    ) {
      endIndex += 1;
    }
    const rowSpan = endIndex - startIndex;
    const shouldMerge = !!currentVoucherId && currentVoucherId !== '--';
    mergedRows[startIndex].voucherIdRowSpan = shouldMerge ? rowSpan : 1;
    mergedRows[startIndex].postingDateRowSpan = shouldMerge ? rowSpan : 1;
    for (let rowIndex = startIndex + 1; rowIndex < endIndex; rowIndex += 1) {
      mergedRows[rowIndex].voucherIdRowSpan = 0;
      mergedRows[rowIndex].postingDateRowSpan = 0;
    }
    startIndex = endIndex;
  }

  for (let startIndex = 0; startIndex < mergedRows.length; ) {
    const currentValue = mergedRows[startIndex].transactionId;
    let endIndex = startIndex + 1;
    while (
      currentValue &&
      currentValue !== '--' &&
      endIndex < mergedRows.length &&
      mergedRows[endIndex].transactionId === currentValue
    ) {
      endIndex += 1;
    }
    const rowSpan = endIndex - startIndex;
    mergedRows[startIndex].transactionIdRowSpan =
      currentValue && currentValue !== '--' ? rowSpan : 1;
    for (let rowIndex = startIndex + 1; rowIndex < endIndex; rowIndex += 1) {
      mergedRows[rowIndex].transactionIdRowSpan = 0;
    }
    startIndex = endIndex;
  }

  return mergedRows;
}

/** 解析暂记方向（1/Dr → 'Dr'，2/Cr → 'Cr'）。 */
function resolveSuspenseEntryDirection(value?: string | number): string {
  const numericDirection = toSafeNumber(value);
  if (numericDirection === 1) return 'Dr';
  if (numericDirection === 2) return 'Cr';
  const textValue = typeof value === 'number' ? String(value) : value;
  const directionText = normalizeTextValue(textValue)?.toUpperCase();
  if (directionText === 'DEBIT' || directionText === 'DR') return 'Dr';
  if (directionText === 'CREDIT' || directionText === 'CR') return 'Cr';
  return normalizeTextValue(textValue) || '--';
}

interface SuspenseEntryRuntime {
  postingDate?: string;
  voucherId?: string;
  voucherNo?: string;
  voucherCode?: string;
  transactionId?: string;
  txId?: string;
  lines?: SuspenseEntryLineRuntime[];
  entries?: SuspenseEntryLineRuntime[];
}

interface SuspenseEntryLineRuntime {
  drCr?: string | number;
  direction?: string | number;
  account?: string;
  accountCode?: string;
  accountName?: string;
  amount?: number | string;
  balance?: number | string;
}

/**
 * EOD 明细原始响应 → 领域 EodStatementDetail（drawer 展示）。
 * 含账户余额行、暂记分录行（合并相邻同 ID 计算 rowSpan）。
 */
export function buildEodStatementDetail(
  detail: EodDetailRespVo | undefined,
  fallbackCurrency?: string,
  fallbackStatement?: EodStatementRow | null
): EodStatementDetail | null {
  if (!detail) return null;

  const accountBalances = Array.isArray(detail.accountBalances)
    ? detail.accountBalances
    : [];
  const currencyCode =
    accountBalances[0]?.currencyCode ||
    detail.currencyCode ||
    fallbackCurrency ||
    '';
  const accountRows = toEodDetailAccountRows(accountBalances, currencyCode);

  const suspenseAssets = formatMoneyWithCurrency(
    (detail.suspenseAssets ?? detail.suspenseAssetAmount ?? 0) as number,
    currencyCode
  );
  const suspenseLiabilities = formatMoneyWithCurrency(
    (detail.suspenseLiabilities ?? detail.suspenseLiabilityAmount ?? 0) as number,
    currencyCode
  );

  const suspenseSourceRows: SuspenseEntryRuntime[] = [
    ...((detail.suspenseEntries as SuspenseEntryRuntime[]) ?? []),
    ...((detail.suspenseEntryRows as SuspenseEntryRuntime[]) ?? []),
    ...((detail.suspenseEntryList as SuspenseEntryRuntime[]) ?? []),
  ];

  const postingMs = parseDateToMs(detail.postingDate);
  const sharedPostingDate = Number.isFinite(postingMs)
    ? formatEodDate(postingMs)
    : fallbackStatement?.eodDate || '--';

  const suspenseRows = suspenseSourceRows.flatMap(
    (entry, entryIndex): EodSuspenseEntryRow[] => {
      const lines: SuspenseEntryLineRuntime[] = Array.isArray(entry.lines)
        ? entry.lines
        : Array.isArray(entry.entries)
          ? entry.entries
          : [entry as unknown as SuspenseEntryLineRuntime];
      const rowSpan = lines.length || 1;
      const entryPostingMs = parseDateToMs(entry.postingDate ?? detail.postingDate);
      const linePostingDate = Number.isFinite(entryPostingMs)
        ? formatEodDate(entryPostingMs)
        : sharedPostingDate;
      const sharedVoucherId =
        normalizeTextValue(entry.voucherId) ||
        normalizeTextValue(entry.voucherNo) ||
        normalizeTextValue(entry.voucherCode) ||
        '--';
      const sharedTransactionId =
        normalizeTextValue(entry.transactionId) ||
        normalizeTextValue(entry.txId) ||
        '--';

      return lines.map((line, lineIndex) => {
        const key = `${entryIndex}-${lineIndex}`;
        return {
          id: key,
          key,
          postingDate: linePostingDate,
          voucherId: sharedVoucherId,
          drCr: resolveSuspenseEntryDirection(line.drCr ?? line.direction),
          account:
            normalizeTextValue(line.account) ||
            [line.accountCode, line.accountName].filter(Boolean).join(' - ') ||
            '--',
          amount: formatMoneyWithCurrency(
            Number(line.amount ?? line.balance ?? 0),
            currencyCode
          ),
          transactionId: sharedTransactionId,
          postingDateRowSpan: lineIndex === 0 ? rowSpan : 0,
          voucherIdRowSpan: lineIndex === 0 ? rowSpan : 0,
          transactionIdRowSpan: lineIndex === 0 ? rowSpan : 0,
        };
      });
    }
  );

  return {
    postingDate: sharedPostingDate,
    bookName:
      normalizeTextValue(detail.bookName) ||
      normalizeTextValue(detail.financialBookName) ||
      '--',
    bookId:
      normalizeTextValue(detail.bookNo) ||
      normalizeTextValue(detail.bookId) ||
      normalizeTextValue(String(detail.financeBookId ?? '')) ||
      '--',
    currencyCode,
    processedBy:
      normalizeTextValue(detail.processedBy) ||
      normalizeTextValue(detail.closedBy) ||
      fallbackStatement?.closedBy ||
      '--',
    summaryTotalAssets: formatMoneyWithCurrency(
      Number(detail.totalAssets ?? 0),
      currencyCode
    ),
    summaryTotalLiabilities: formatMoneyWithCurrency(
      Number(detail.totalLiabilities ?? 0),
      currencyCode
    ),
    suspenseAssets,
    suspenseLiabilities,
    balancingStatus: resolveEodAccountingStatus(detail.accountingStatus),
    exceptionContext:
      normalizeTextValue(detail.exceptionContext) ||
      normalizeTextValue(detail.exceptionReason) ||
      normalizeTextValue(detail.reason) ||
      '--',
    allowPostToSuspense: false,
    assetRows: accountRows,
    liabilityRows: [],
    suspenseRows: mergeAdjacentSuspenseEntryIds(suspenseRows),
  };
}
