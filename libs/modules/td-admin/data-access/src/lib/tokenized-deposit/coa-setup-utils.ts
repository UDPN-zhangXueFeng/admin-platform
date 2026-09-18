/**
 * COA Financial Book 初始化工具函数（13 项：10 函数 + 2 常量 + 1 mock）。
 *
 * ## 去重记录（Rule 7，tokenized-deposit.md 第 8.22 章）
 *
 * - 删除 coa-setup/types.ts 的重复函数：`getCoaSetupFieldError` / `validateCoaSetup` / `hasCoaSetupErrors`，
 *   仅保留本文件版本。
 * - 删除 coa-setup/types.ts 的重复常量：`FINANCIAL_BOOK_NAME_PATTERN` / `REQUIRED_COA_SETUP_FIELDS`，
 *   本文件从 constants.ts 导入 `FINANCIAL_BOOK_NAME_PATTERN` / `FINANCIAL_BOOK_NAME_RULE_MESSAGE`，
 *   复用已有常量（`tokenized-deposit.constants.ts` 第 196-201 行）。
 * - `mapCoaSetupToPayload` 与 `mapCoaSetupToApplyAddPayload` 逐字符相同 → 合并为 `mapCoaSetupToPayload`。
 * - 丢弃未被引用的 `configuredCoaSetupMock`（coa-setup/mock.ts 第 3-12 行）。
 *
 * ## 类型定位
 *
 * 本文件位于 `type:util` 层，不 import `type:data-access`（Nx enforce-module-boundaries 禁止）。
 * CoaSetupInfo / CoaSetupErrors / CoaSetupOption 定义为本文件的结构类型，
 * 与 data-access model.ts 同名类型保持形状一致。调用方（feature/data-access）使用时，
 * TypeScript 结构类型系统自动兼容，无需显式类型转换。
 *
 * ## 时间处理
 *
 * 本文件不调用 dayjs。COA EOD 时间（HH:mm:ss）仅在 `mapDetailToCoaSetup` /
 * `mapFinanceBookToCoaSetup` 中做字符串传递（eodCutoffDate → eodCutOffTime），
 * TimePicker 的格式转换在 td-9（coa-setup-card）处理。
 */

import {
  FINANCIAL_BOOK_NAME_PATTERN,
  FINANCIAL_BOOK_NAME_RULE_MESSAGE,
  MINT_METHOD,
} from './tokenized-deposit.constants';

// ═══════════════════════════════════════════════════════════════════
// 结构类型（util 层自包含，与 data-access model.ts 同名类型形状一致）
// ═══════════════════════════════════════════════════════════════════

/** COA 设置状态。 */
type CoaSetupStatus = 'configured' | 'setup_required';

/** COA Financial Book 初始化数据结构。 */
interface CoaSetupInfo {
  reserveAccountId?: number | string;
  status: CoaSetupStatus;
  financialBookName?: string;
  accountTemplateCode?: string;
  accountTemplateName?: string;
  eodCutOffTime?: string;
  timeZone?: string;
  timeZoneLabel?: string;
  linkedMessage?: string;
  headerNote?: string;
}

/** COA 字段校验错误映射。 */
type CoaSetupErrors = Partial<
  Record<
    'financialBookName' | 'accountTemplateCode' | 'eodCutOffTime' | 'timeZone',
    string
  >
>;

/** COA 下拉选项（科目模板 / 时区）。 */
interface CoaSetupOption {
  value: string;
  label: string;
}

/** 编辑详情回填的口子类型（mapDetailToCoaSetup 的输入）。 */
interface DetailForCoaSetup {
  reserveAccountId?: number;
  bookName?: string;
  bookTemplateId?: number;
  bookTemplateName?: string;
  timeZone?: string;
  eodCutoffDate?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// 常量（2 项 + 1 mock）
// ═══════════════════════════════════════════════════════════════════

/**
 * COA 各字段的必填校验定义。
 *
 * 去重：原 coa-setup/types.ts 与 edit/constants.ts 均定义了此常量，
 * 本文件是唯一保留版本。
 */
export const REQUIRED_COA_SETUP_FIELDS: Array<{
  key: keyof CoaSetupErrors;
  label: string;
}> = [
  { key: 'financialBookName', label: 'Financial Book Name' },
  { key: 'accountTemplateCode', label: 'Account Template' },
  { key: 'eodCutOffTime', label: 'End of Day (EOD) Cut-off Time' },
  { key: 'timeZone', label: 'Time Zone' },
];

/**
 * COA 运行时 fallback 初始态（setup_required）。
 *
 * 来源：coa-setup/mock.ts `setupRequiredCoaSetupMock`（第 14-22 行）。
 * 用途：新 TD（无 FinanceBookRespVo）时 mapFinanceBookToCoaSetup 的回退值，
 *       以及 useCoaSetup hook 的初始 state。
 */
export const setupRequiredCoaSetupMock: CoaSetupInfo = {
  status: 'setup_required',
  financialBookName: '',
  accountTemplateCode: '',
  accountTemplateName: '',
  eodCutOffTime: '00:00:00',
  timeZone: 'Europe/Paris',
  timeZoneLabel: '(UTC+01:00) Europe/Paris - Central European Time',
};

// ═══════════════════════════════════════════════════════════════════
// 函数 1: getCoaTemplateTokenType
// ═══════════════════════════════════════════════════════════════════

/**
 * 将 mintMethod 映射为 COA 科目模板的 tokenType 查询参数。
 *
 * - 1（Stablecoin） → 1
 * - 5（Tokenized Deposit） → 5
 * - 20（MMF Token） → undefined（MMF 无 Financial Book）
 *
 * @param mintMethod 铸币方法（1 | 5 | 20 | undefined）
 * @returns tokenType 值或 undefined
 */
export const getCoaTemplateTokenType = (
  mintMethod: number | undefined,
): 1 | 5 | undefined => {
  if (mintMethod === MINT_METHOD.STABLECOIN) return MINT_METHOD.STABLECOIN;
  if (mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT) {
    return MINT_METHOD.TOKENIZED_DEPOSIT;
  }
  return undefined;
};

// ═══════════════════════════════════════════════════════════════════
// 函数 2: mapFinanceBookToCoaSetup
// ═══════════════════════════════════════════════════════════════════

/**
 * FinanceBookRespVo（按 reserveAccountId 拉取的 Financial Book）→ CoaSetupInfo 映射。
 *
 * - 有 book 数据 → status='configured'（只读态）
 * - 无 book 数据 → 返回 setupRequiredCoaSetupMock + 指定的 reserveAccountId
 *
 * @param financeBook 后端返回的 Financial Book 对象（可为 null/undefined）
 * @param reserveAccountId 储备账户 ID（用于无 book 回退或补字段）
 */
export const mapFinanceBookToCoaSetup = (
  financeBook: Record<string, unknown> | null | undefined,
  reserveAccountId: string | number,
): CoaSetupInfo => {
  const hasFinanceBook = Boolean(
    financeBook &&
      (financeBook.financeBookId !== undefined ||
        financeBook.bookTemplateId !== undefined ||
        financeBook.bookName),
  );

  if (!hasFinanceBook) {
    return {
      ...setupRequiredCoaSetupMock,
      reserveAccountId,
    };
  }

  return {
    reserveAccountId:
      (financeBook?.reserveAccountId as string | number) ?? reserveAccountId,
    status: 'configured',
    financialBookName: (financeBook?.bookName as string) || '',
    accountTemplateCode:
      financeBook?.bookTemplateId !== undefined
        ? String(financeBook.bookTemplateId)
        : (financeBook?.bookTemplateName as string) || '',
    accountTemplateName: (financeBook?.bookTemplateName as string) || '',
    eodCutOffTime: (financeBook?.eodCutoffDate as string) || '',
    timeZone: (financeBook?.timeZone as string) || '',
    timeZoneLabel: (financeBook?.timeZone as string) || '',
  };
};

// ═══════════════════════════════════════════════════════════════════
// 函数 3: mapDetailToCoaSetup
// ═══════════════════════════════════════════════════════════════════

/**
 * 编辑回填：TDEditDetail（getDetailApi 返回）→ CoaSetupInfo。
 *
 * - `bookTemplateId`（number） → `accountTemplateCode`（string）
 * - `eodCutoffDate`（API 字段） → `eodCutOffTime`（前端字段）
 * - setup_required 态且无 eodCutoffDate 时，回退 mock 默认值
 *
 * @param detail 编辑详情回填数据（TDEditDetail）
 * @param status COA 状态（configured | setup_required）
 */
export const mapDetailToCoaSetup = (
  detail: DetailForCoaSetup,
  status: CoaSetupInfo['status'],
): CoaSetupInfo => {
  const isSetupRequired = status === 'setup_required';

  return {
    reserveAccountId: detail.reserveAccountId,
    status,
    financialBookName: detail.bookName || '',
    accountTemplateCode:
      detail.bookTemplateId !== undefined
        ? String(detail.bookTemplateId)
        : detail.bookTemplateName || '',
    accountTemplateName: detail.bookTemplateName || '',
    timeZone: detail.timeZone || '',
    timeZoneLabel: detail.timeZone || '',
    eodCutOffTime:
      detail.eodCutoffDate ||
      (isSetupRequired ? setupRequiredCoaSetupMock.eodCutOffTime : ''),
  };
};

// ═══════════════════════════════════════════════════════════════════
// 函数 4: withDefaultAccountTemplate
// ═══════════════════════════════════════════════════════════════════

/**
 * 当 COA 的 accountTemplateCode / accountTemplateName 为空时，填入默认科目模板。
 *
 * @param coaSetup 当前 COA 设置
 * @param defaultOption 默认科目模板选项（通常为下拉列表第一项）
 * @returns 填充默认值后的 CoaSetupInfo（若无改动则返回同一引用）
 */
export const withDefaultAccountTemplate = (
  coaSetup: CoaSetupInfo,
  defaultOption?: CoaSetupOption,
): CoaSetupInfo => {
  if (
    !defaultOption ||
    coaSetup.accountTemplateCode ||
    coaSetup.accountTemplateName
  ) {
    return coaSetup;
  }

  return {
    ...coaSetup,
    accountTemplateCode: defaultOption.value,
    accountTemplateName: defaultOption.label,
  };
};

/**
 * 当 COA 未返回时区时，填入当前浏览器时区对应的默认选项。
 * 已配置的时区或展示标签始终优先，避免覆盖后端的 Financial Book 配置。
 */
export const withDefaultCoaTimezone = (
  coaSetup: CoaSetupInfo,
  defaultOption?: CoaSetupOption,
): CoaSetupInfo => {
  if (!defaultOption || coaSetup.timeZone || coaSetup.timeZoneLabel) {
    return coaSetup;
  }

  return {
    ...coaSetup,
    timeZone: defaultOption.value,
    timeZoneLabel: defaultOption.label,
  };
};

// ═══════════════════════════════════════════════════════════════════
// 函数 5: resolveCoaSetupTimeZone
// ═══════════════════════════════════════════════════════════════════

/**
 * 时区归一化：将传入的时区字符串与 option 列表匹配，返回标准 value。
 *
 * 规则：
 * 1. 空/空白 → 返回空字符串
 * 2. 查找 option.value 完全匹配 → 返回该 value
 * 3. 查找 option.label 完全匹配 → 返回该 value
 * 4. 均不匹配 → 返回原始值
 *
 * @param timeZone 原始时区字符串
 * @param timezoneOptions 时区下拉选项列表
 * @returns 归一化后的时区 value
 */
export const resolveCoaSetupTimeZone = (
  timeZone: string | undefined,
  timezoneOptions?: CoaSetupOption[],
): string => {
  const normalizedTimeZone = timeZone?.trim() || '';

  if (!normalizedTimeZone) return '';

  return (
    timezoneOptions?.find(
      (option) =>
        option.value === normalizedTimeZone ||
        option.label === normalizedTimeZone,
    )?.value || normalizedTimeZone
  );
};

// ═══════════════════════════════════════════════════════════════════
// 函数 6: normalizeCoaSetupTimeZone
// ═══════════════════════════════════════════════════════════════════

/**
 * 同步 CoaSetupInfo 的 timeZone 与 timeZoneLabel。
 *
 * - 调用 resolveCoaSetupTimeZone 归一化 timeZone
 * - 若归一化值不变 → 返回原引用
 * - 否则 → 生成新对象（timeZone = 归一化值，timeZoneLabel = 选项 label 或原 label）
 *
 * @param coaSetup 当前 COA 设置
 * @param timezoneOptions 时区下拉选项列表
 * @returns 时区同步后的 CoaSetupInfo
 */
export const normalizeCoaSetupTimeZone = (
  coaSetup: CoaSetupInfo,
  timezoneOptions?: CoaSetupOption[],
): CoaSetupInfo => {
  const resolvedTimeZone = resolveCoaSetupTimeZone(
    coaSetup.timeZone || coaSetup.timeZoneLabel,
    timezoneOptions,
  );

  if (resolvedTimeZone === (coaSetup.timeZone || '')) return coaSetup;

  return {
    ...coaSetup,
    timeZone: resolvedTimeZone,
    timeZoneLabel:
      timezoneOptions?.find((option) => option.value === resolvedTimeZone)
        ?.label ||
      coaSetup.timeZoneLabel ||
      resolvedTimeZone,
  };
};

// ═══════════════════════════════════════════════════════════════════
// 函数 7: mapCoaSetupToPayload（合并版）
// ═══════════════════════════════════════════════════════════════════

/**
 * CoaSetupInfo → 提交 payload 映射。
 *
 * ## 去重
 *
 * 原 utils.ts 中 `mapCoaSetupToPayload` 与 `mapCoaSetupToApplyAddPayload` 逐字符相同，
 * 仅函数名不同。合并为 `mapCoaSetupToPayload`，同时用于编辑提交（tdOperationEditApi）
 * 和新增提交（tdApplyAddApi）。
 *
 * @param coaSetup 当前 COA 设置（可为 null/undefined，返回空对象）
 * @param timezoneOptions 时区下拉选项（用于时区归一化）
 * @returns { bookName, bookTemplateId?, timeZone, eodCutoffDate }
 */
export const mapCoaSetupToPayload = (
  coaSetup: CoaSetupInfo | null | undefined,
  timezoneOptions?: CoaSetupOption[],
): {
  bookName: string;
  bookTemplateId?: number;
  timeZone: string;
  eodCutoffDate: string;
} => {
  if (!coaSetup) return {} as ReturnType<typeof mapCoaSetupToPayload>;

  const accountTemplateCode = coaSetup.accountTemplateCode?.trim() || '';
  const bookTemplateId = Number(accountTemplateCode);

  return {
    bookName: coaSetup.financialBookName || '',
    ...(accountTemplateCode && Number.isFinite(bookTemplateId)
      ? { bookTemplateId }
      : {}),
    timeZone: resolveCoaSetupTimeZone(coaSetup.timeZone, timezoneOptions),
    eodCutoffDate: coaSetup.eodCutOffTime || '',
  };
};

// ═══════════════════════════════════════════════════════════════════
// 函数 8: getCoaSetupFieldError
// ═══════════════════════════════════════════════════════════════════

/**
 * 校验单个 COA 字段，返回错误信息或 undefined。
 *
 * 校验规则：
 * 1. 空值 / 空白字符串 → `Please enter the ${field.label}`
 * 2. financialBookName 不符合 FINANCIAL_BOOK_NAME_PATTERN → FINANCIAL_BOOK_NAME_RULE_MESSAGE
 *
 * @param field 字段定义（key + label）
 * @param coaSetup 当前 COA 设置（可为 null/undefined）
 * @returns 错误信息字符串或 undefined（无错）
 */
export const getCoaSetupFieldError = (
  field: (typeof REQUIRED_COA_SETUP_FIELDS)[number],
  coaSetup: CoaSetupInfo | null | undefined,
): string | undefined => {
  const value = coaSetup?.[field.key];

  if (typeof value === 'string' ? value.trim() === '' : !value) {
    return `Please enter the ${field.label}`;
  }

  if (
    field.key === 'financialBookName' &&
    !FINANCIAL_BOOK_NAME_PATTERN.test(String(value))
  ) {
    return FINANCIAL_BOOK_NAME_RULE_MESSAGE;
  }

  return undefined;
};

// ═══════════════════════════════════════════════════════════════════
// 函数 9: validateCoaSetup
// ═══════════════════════════════════════════════════════════════════

/**
 * 全量校验 CoaSetupInfo，返回所有字段的错误映射（CoaSetupErrors）。
 *
 * 对 REQUIRED_COA_SETUP_FIELDS 逐字段调用 getCoaSetupFieldError，
 * 仅在有错误的字段上设置 key → message。
 *
 * @param coaSetup 当前 COA 设置（可为 null/undefined）
 * @returns CoaSetupErrors（空对象表示全部通过）
 */
export const validateCoaSetup = (
  coaSetup: CoaSetupInfo | null | undefined,
): CoaSetupErrors => {
  return REQUIRED_COA_SETUP_FIELDS.reduce<CoaSetupErrors>((errors, field) => {
    const error = getCoaSetupFieldError(field, coaSetup);

    if (error) {
      errors[field.key] = error;
    }

    return errors;
  }, {});
};

// ═══════════════════════════════════════════════════════════════════
// 函数 10: hasCoaSetupErrors
// ═══════════════════════════════════════════════════════════════════

/**
 * 判断 CoaSetupErrors 是否包含错误。
 *
 * @param errors 校验错误映射
 * @returns true = 有错误
 */
export const hasCoaSetupErrors = (errors: CoaSetupErrors): boolean =>
  Object.keys(errors).length > 0;

// ═══════════════════════════════════════════════════════════════════
// 函数 11: getNextCoaSetupErrors
// ═══════════════════════════════════════════════════════════════════

/**
 * 增量校验：基于已有错误映射 + 新数据，计算下一帧错误状态。
 *
 * 行为（与源 utils.ts 第 215-232 行一致）：
 * 1. 浅拷贝 currentErrors
 * 2. 对每个必填字段重新校验：
 *    - 无错 → 从 nextErrors 中删除该字段（用户已修正）
 *    - 有错且为 financialBookName 且有值 → 更新该字段的错误信息
 *    - 其他有错 → 保留原错误（不覆盖）
 *
 * @param currentErrors 当前错误映射
 * @param data 最新的 COA 设置数据
 * @returns 更新后的错误映射
 */
export const getNextCoaSetupErrors = (
  currentErrors: CoaSetupErrors,
  data: CoaSetupInfo,
): CoaSetupErrors => {
  const nextErrors = { ...currentErrors };

  REQUIRED_COA_SETUP_FIELDS.forEach((field) => {
    const error = getCoaSetupFieldError(field, data);

    if (!error) {
      delete nextErrors[field.key];
    } else if (field.key === 'financialBookName' && data.financialBookName) {
      nextErrors[field.key] = error;
    }
  });

  return nextErrors;
};
