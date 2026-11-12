/**
 * Chart of Accounts 详情页 Trial Balance 数据转换。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `view/utils.ts`（getTrialBalanceRange /
 * buildTrialBalanceSummary / buildTrialBalanceActivityRows 及内部辅助），
 * 仅做两项适配：日期以 `Date` + `YYYY-MM-DD` 字符串表示（不依赖 dayjs）；
 * 每行注入 `id = key` 以满足 shared DataTable 的 `{ id: string }` 契约。
 */
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

import { normalizeTextValue } from './chart-of-accounts.constants';
import {
  formatMoneyWithCurrency,
  formatOptionalMoneyWithCurrency,
  parseDateToMs,
} from './chart-of-accounts-eod.utils';
import type {
  TrialBalanceActivityItemResp,
  TrialBalanceActivityResp,
  TrialBalanceActivityRow,
  TrialBalanceAsOfOption,
  TrialBalanceEventType,
  TrialBalanceItemResp,
  TrialBalanceRange,
  TrialBalanceResp,
  TrialBalanceRow,
  TrialBalanceSummary,
} from './chart-of-accounts-detail.model';

const ISO_DATE_FORMAT = 'yyyy-MM-dd';

/** `YYYY-MM-DD` → 本地时区当天 0 点；非法返回 `NaN` 日期。 */
function parseIsoDay(value?: string): Date {
  if (!value) return new Date(Number.NaN);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return new Date(Number.NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * 解析 `lastEodPostingRun`（可能是 epoch ms / 日期字符串 / 带 `(UTC+8)` 后缀的
 * 展示文本，源项目会先剥离后缀）；无法解析返回 `undefined`。
 */
function parseLastEodPostingRun(
  lastEodPostingRun?: string | number
): Date | undefined {
  if (lastEodPostingRun === undefined || lastEodPostingRun === null) {
    return undefined;
  }

  const normalized =
    typeof lastEodPostingRun === 'string'
      ? lastEodPostingRun.replace(/\s*\(UTC[+-]\d+\)\s*$/, '')
      : lastEodPostingRun;
  const ms = parseDateToMs(normalized);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
}

/**
 * as-of 选项 + 自定义日期 → 试算平衡查询区间。
 * `end-of-last-eod` 以 Last EOD Posting Run 为截止日（解析失败回退今天）。
 */
export function getTrialBalanceRange(
  asOf: TrialBalanceAsOfOption,
  customDateRange: [string, string] | null,
  lastEodPostingRun?: string | number
): TrialBalanceRange {
  const today = new Date();
  const buildRange = (startDate: Date, endDate: Date): TrialBalanceRange => ({
    startDate: format(startDate, ISO_DATE_FORMAT),
    endDate: format(endDate, ISO_DATE_FORMAT),
    startTime: startDate.getTime(),
    endTime: endDate.getTime(),
  });

  if (asOf === 'custom-date' && customDateRange?.[0] && customDateRange?.[1]) {
    const start = parseIsoDay(customDateRange[0]);
    const end = parseIsoDay(customDateRange[1]);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      return buildRange(startOfDay(start), endOfDay(end));
    }
  }

  if (asOf === 'end-of-last-eod') {
    const endDate = parseLastEodPostingRun(lastEodPostingRun) ?? today;
    return buildRange(startOfMonth(endDate), endDate);
  }

  if (asOf === 'end-of-last-month') {
    const endDate = endOfMonth(subMonths(today, 1));
    return buildRange(startOfMonth(endDate), endDate);
  }

  if (asOf === 'end-of-last-quarter') {
    const endDate = subDays(startOfQuarter(today), 1);
    return buildRange(startOfQuarter(endDate), endDate);
  }

  if (asOf === 'end-of-last-year') {
    const endDate = endOfYear(subYears(today, 1));
    return buildRange(startOfYear(endDate), endDate);
  }

  return buildRange(startOfMonth(today), today);
}

/** 后端科目分组（数字 / 文本）→ assets / liabilities；未识别按 assets（源行为）。 */
export function resolveTrialBalanceSectionType(
  value?: string | number
): 'assets' | 'liabilities' {
  if (value === 1) return 'assets';
  if (typeof value === 'number') return 'liabilities';

  const normalizedValue =
    value === undefined ? undefined : String(value).trim().toLowerCase();
  if (
    normalizedValue === 'liability' ||
    normalizedValue === 'liabilities' ||
    normalizedValue === 'liability_section'
  ) {
    return 'liabilities';
  }

  return 'assets';
}

/** 借贷方向（1/Dr、2/Cr）→ 'Dr' / 'Cr'；未识别返回 undefined。 */
function formatTrialBalanceDrCr(
  value?: string | number
): 'Dr' | 'Cr' | undefined {
  const normalizedValue = (normalizeTextValue(
    value === undefined || value === null ? undefined : String(value)
  ) ?? '').toLowerCase();

  if (normalizedValue === '1' || normalizedValue === 'dr') return 'Dr';
  if (normalizedValue === '2' || normalizedValue === 'cr') return 'Cr';
  return undefined;
}

/** 科目余额项 → 展示行（不含 children 递归）。 */
export function buildTrialBalanceRow(
  item: TrialBalanceItemResp,
  index: number,
  currencyCode?: string,
  sectionType: 'assets' | 'liabilities' = resolveTrialBalanceSectionType(
    item.sectionType
  ),
  depthOverride?: number
): TrialBalanceRow {
  const accountCode = normalizeTextValue(item.accountCode) || '--';
  const accountName = normalizeTextValue(item.accountName) || '--';
  const depth =
    depthOverride ??
    (accountCode === '--'
      ? 0
      : Math.max(accountCode.split('.').length - 1, 0));

  return {
    id: `${accountCode}-${index}`,
    key: `${accountCode}-${index}`,
    sectionType,
    accountCode,
    accountName,
    accountLabel:
      accountCode !== '--' && accountName !== '--'
        ? `${accountCode} – ${accountName}`
        : accountName !== '--'
          ? accountName
          : accountCode,
    depth,
    isGroup: !!item.children?.length,
    openingSide: formatTrialBalanceDrCr(item.openingDrCr) || '--',
    opening: formatMoneyWithCurrency(item.openingBalance, currencyCode),
    debit: formatMoneyWithCurrency(item.periodDebit, currencyCode),
    credit: formatMoneyWithCurrency(item.periodCredit, currencyCode),
    activitySide: formatTrialBalanceDrCr(item.activityDrCr) || '--',
    closing: formatMoneyWithCurrency(item.closingBalance, currencyCode),
    hasActivity: !!item.hasActivity,
  };
}

function buildTrialBalanceTreeRows(
  items: TrialBalanceItemResp[],
  currencyCode: string,
  sectionType: 'assets' | 'liabilities',
  parentKey: string,
  depth = 0
): TrialBalanceRow[] {
  return items.flatMap((item, index) => {
    const row = buildTrialBalanceRow(
      item,
      index,
      currencyCode,
      sectionType,
      depth
    );
    const key = `${parentKey}-${row.accountCode}-${index}`;
    const children = item.children?.length
      ? buildTrialBalanceTreeRows(
          item.children,
          currencyCode,
          sectionType,
          key,
          depth + 1
        )
      : undefined;

    return [
      { ...row, id: key, key, isGroup: !!children?.length },
      ...(children ?? []),
    ];
  });
}

function getTrialBalanceSectionRootItems(
  items: TrialBalanceItemResp[],
  sectionType: 'assets' | 'liabilities'
): TrialBalanceItemResp[] {
  return items.filter(
    (item) => resolveTrialBalanceSectionType(item.sectionType) === sectionType
  );
}

/** 一级科目：无 parentCode 且 level 为 0/1（或编码不含 '.'）。 */
function getFirstLevelTrialBalanceItems(
  items: TrialBalanceItemResp[]
): TrialBalanceItemResp[] {
  return items.filter((item) => {
    const normalizedParentCode = normalizeTextValue(item.parentCode);
    const normalizedAccountCode = normalizeTextValue(item.accountCode);
    const level = Number(item.level);

    if (normalizedParentCode) return false;
    if (Number.isFinite(level)) return level === 0 || level === 1;
    return !normalizedAccountCode?.includes('.');
  });
}

/** 从运行时响应按候选字段名取第一个非空值（兼容后端字段别名，源行为）。 */
function pickRuntimeValue(
  source: Record<string, unknown> | undefined,
  keys: string[]
): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/**
 * 试算平衡响应 → 汇总视图。
 * `sourceItems` 按科目分组拆成 Assets / Liabilities 两棵树，并在末尾各追加
 * 一行小计（期末合计优先取响应汇总值，源行为）。
 */
export function buildTrialBalanceSummary(
  data: TrialBalanceResp | undefined,
  params: {
    fallbackCurrency?: string;
    asOf: TrialBalanceAsOfOption;
    startDate?: string;
    endDate?: string;
    /** 小计行文案（组件层本地化；缺省为英文）。 */
    subtotalLabels?: { assets?: string; liabilities?: string };
  }
): TrialBalanceSummary {
  // 源项目为不同后端版本保留了字段别名；这里把响应降为索引签名对象再做候选字段取值。
  const runtimeData = data as unknown as Record<string, unknown> | undefined;
  const currencyCode = data?.currencyCode || params.fallbackCurrency || '';
  const summaryTotalAssets = pickRuntimeValue(runtimeData, [
    'totalAssets',
    'totalAsset',
    'assetTotal',
    'assetsTotal',
    'totalAssetsAmount',
    'summaryTotalAssets',
  ]);
  const summaryTotalLiabilities = pickRuntimeValue(runtimeData, [
    'totalLiabilities',
    'totalLiability',
    'liabilityTotal',
    'liabilitiesTotal',
    'totalLiabilitiesAmount',
    'summaryTotalLiabilities',
  ]);
  const formattedSummaryTotalAssets = formatOptionalMoneyWithCurrency(
    summaryTotalAssets,
    currencyCode
  );
  const formattedSummaryTotalLiabilities = formatOptionalMoneyWithCurrency(
    summaryTotalLiabilities,
    currencyCode
  );

  const sourceItems = data?.items ?? [];
  const assetRootItems = getTrialBalanceSectionRootItems(sourceItems, 'assets');
  const liabilityRootItems = getTrialBalanceSectionRootItems(
    sourceItems,
    'liabilities'
  );
  const assetRows = buildTrialBalanceTreeRows(
    assetRootItems,
    currencyCode,
    'assets',
    'assets'
  );
  const liabilityRows = buildTrialBalanceTreeRows(
    liabilityRootItems,
    currencyCode,
    'liabilities',
    'liabilities'
  );

  const buildSubtotalRow = (
    sectionType: 'assets' | 'liabilities',
    label: string,
    rootItems: TrialBalanceItemResp[]
  ): TrialBalanceRow => {
    const firstLevelItems = getFirstLevelTrialBalanceItems(rootItems);
    const openingTotal = firstLevelItems.reduce(
      (sum, item) => sum + Number(item.openingBalance || 0),
      0
    );
    const debitTotal = firstLevelItems.reduce(
      (sum, item) => sum + Number(item.periodDebit || 0),
      0
    );
    const creditTotal = firstLevelItems.reduce(
      (sum, item) => sum + Number(item.periodCredit || 0),
      0
    );
    const closingTotal = firstLevelItems.reduce(
      (sum, item) => sum + Number(item.closingBalance || 0),
      0
    );
    const firstItem = firstLevelItems[0];
    const summaryValue =
      sectionType === 'assets'
        ? formattedSummaryTotalAssets
        : formattedSummaryTotalLiabilities;

    return {
      id: `subtotal-${sectionType}`,
      key: `subtotal-${sectionType}`,
      sectionType,
      accountCode: '',
      accountName: label,
      accountLabel: label,
      depth: 0,
      isGroup: false,
      isSubtotal: true,
      openingSide:
        formatTrialBalanceDrCr(firstItem?.openingDrCr) ||
        (sectionType === 'assets' ? 'Dr' : 'Cr'),
      opening: formatMoneyWithCurrency(openingTotal, currencyCode),
      debit: formatMoneyWithCurrency(debitTotal, currencyCode),
      credit: formatMoneyWithCurrency(creditTotal, currencyCode),
      activitySide:
        formatTrialBalanceDrCr(firstItem?.activityDrCr) ||
        (sectionType === 'assets' ? 'Dr' : 'Cr'),
      closing:
        summaryValue !== '--'
          ? summaryValue
          : formatMoneyWithCurrency(closingTotal, currencyCode),
      hasActivity: false,
    };
  };

  const periodText =
    params.startDate && params.endDate
      ? `${params.startDate} → ${params.endDate}`
      : '--';

  return {
    periodText,
    totalAssets: formattedSummaryTotalAssets,
    totalLiabilities: formattedSummaryTotalLiabilities,
    balancingCheck: normalizeTextValue(data?.balancingCheck) || '--',
    asOfDate: params.endDate || '--',
    assetRows: [
      ...assetRows,
      buildSubtotalRow(
        'assets',
        params.subtotalLabels?.assets ?? 'Subtotal — Assets',
        assetRootItems
      ),
    ],
    liabilityRows: [
      ...liabilityRows,
      buildSubtotalRow(
        'liabilities',
        params.subtotalLabels?.liabilities ?? 'Subtotal — Liabilities',
        liabilityRootItems
      ),
    ],
  };
}

export type TrialBalanceActivitySource =
  | TrialBalanceActivityResp
  | TrialBalanceActivityItemResp[]
  | undefined;

/** 科目活动响应 → 明细项数组（兼容数组与 `{ items }` 两种形态）。 */
export function getTrialBalanceActivityItems(
  data: TrialBalanceActivitySource
): TrialBalanceActivityItemResp[] {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

const TRIAL_BALANCE_EVENT_TYPE_TEXT_MAP: Record<string, TrialBalanceEventType> = {
  reservein: 'reserveIn',
  fundingin: 'fundingIn',
  mint: 'mint',
  repositoryout: 'repositoryOut',
  transfer: 'transfer',
  repositoryin: 'repositoryIn',
  melt: 'melt',
  reserveout: 'reserveOut',
  fundingout: 'fundingOut',
};

const TRIAL_BALANCE_EVENT_TYPE_NUMBER_MAP: Record<number, TrialBalanceEventType> = {
  1: 'reserveIn',
  3: 'fundingIn',
  5: 'mint',
  10: 'repositoryOut',
  15: 'transfer',
  20: 'repositoryIn',
  25: 'melt',
  30: 'reserveOut',
  35: 'fundingOut',
};

/**
 * 事件类型解析（源 `getTrialBalanceEventTypeI18nKey`）：
 * `1/30` 在 token type 5（TD）下分别视为 Funding in / Funding out；
 * 文本值先归一化为事件名再按数字规则处理。
 */
export function resolveTrialBalanceEventType(
  sourceEventType?: string | number,
  tokenType?: number
): TrialBalanceEventType | undefined {
  const normalizedValue = normalizeTextValue(
    sourceEventType === undefined || sourceEventType === null
      ? undefined
      : String(sourceEventType)
  );
  if (!normalizedValue) return undefined;

  const numericEventType = Number(normalizedValue);
  const isNumeric = Number.isFinite(numericEventType);
  let eventType: TrialBalanceEventType | undefined = isNumeric
    ? TRIAL_BALANCE_EVENT_TYPE_NUMBER_MAP[numericEventType]
    : TRIAL_BALANCE_EVENT_TYPE_TEXT_MAP[
        normalizedValue.replace(/[\s_-]/g, '').toLowerCase()
      ];
  if (!eventType) return undefined;

  if (eventType === 'reserveIn' && tokenType === 5) eventType = 'fundingIn';
  if (eventType === 'reserveOut' && tokenType === 5) eventType = 'fundingOut';

  return eventType;
}

/**
 * 科目活动响应 → 明细行。
 * 借方/贷方金额按方向拆分，Running Balance 优先取后端累计值（源逻辑）。
 */
export function buildTrialBalanceActivityRows(
  data: TrialBalanceActivitySource,
  params: {
    accountCode?: string;
    accountName?: string;
    currencyCode?: string;
    tokenType?: number;
  }
): TrialBalanceActivityRow[] {
  const items = getTrialBalanceActivityItems(data);
  let runningBalance = 0;

  return items.map((item, index) => {
    const amount = Number(item.amount || 0);
    const directionText = String(item.direction ?? '').trim().toUpperCase();
    const isDebit =
      item.direction === 1 ||
      directionText === 'DEBIT' ||
      directionText === 'DR';
    runningBalance += isDebit ? amount : -amount;

    const postingMs = parseDateToMs(item.createTime ?? item.postingDate);
    const runningBalanceValue = Number.isFinite(Number(item.runningBalance))
      ? Number(item.runningBalance)
      : runningBalance;
    const accountCode =
      normalizeTextValue(item.accountCode) ||
      normalizeTextValue(params.accountCode) ||
      '--';
    const accountName =
      normalizeTextValue(item.accountName) ||
      normalizeTextValue(params.accountName) ||
      '--';
    const key = String(item.postingAccountBalanceId || `${accountCode}-${index}`);

    return {
      id: key,
      key,
      postingDate: Number.isFinite(postingMs)
        ? format(new Date(postingMs), 'MMM d, yyyy')
        : '--',
      transactionId:
        normalizeTextValue(item.tranId) || normalizeTextValue(item.txCode) || '--',
      eventTypeName: normalizeTextValue(item.eventTypeName),
      eventTypeCode: resolveTrialBalanceEventType(
        item.eventType,
        params.tokenType
      ),
      eventTypeRaw: normalizeTextValue(
        item.eventType === undefined || item.eventType === null
          ? undefined
          : String(item.eventType)
      ),
      account:
        accountCode !== '--' && accountName !== '--'
          ? `${accountCode} – ${accountName}`
          : accountName !== '--'
            ? accountName
            : accountCode,
      offsettingAccount:
        item.offsettingAccountCode && item.offsettingAccountName
          ? `${item.offsettingAccountCode} – ${item.offsettingAccountName}`
          : item.offsettingAccountName || item.offsettingAccountCode || '--',
      debitAmount: isDebit
        ? formatMoneyWithCurrency(amount, params.currencyCode)
        : '--',
      creditAmount: isDebit
        ? '--'
        : formatMoneyWithCurrency(amount, params.currencyCode),
      runningBalance: formatMoneyWithCurrency(
        runningBalanceValue,
        item.currencyCode || params.currencyCode
      ),
      eventCode: normalizeTextValue(item.eventCode) || '--',
    };
  });
}
