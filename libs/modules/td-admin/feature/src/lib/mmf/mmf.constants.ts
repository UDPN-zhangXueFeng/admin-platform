/**
 * mmf（Money Market Fund / Dividend，分红计提与结算）枚举常量与状态映射。
 *
 * 迁移自 td-manage mmf（accrual/index / accrual/view / settlement/index / settlement/view）。
 * 合并了原 4 处重复定义的 approvalTaskStatus（accrual 两处键值相同、settlement 两处键值相同）、
 * 1 处独立 mmfSettlementRecordsStatus、5 个 limit 权限码。
 *
 * 审批记录状态（settlement view Tab2）不使用静态映射：
 * 色值走 i18n key `approval_task_status_color_${state}`、文案走 `common_task_status_${state}`，
 * 属于全局 common 约定，不在本常量文件中硬编码。
 */

// ── 通用 ──
export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';
// 非空占位：Radix Select 禁止 SelectItem value 为空串（accrual-list 链/币种下拉用原生
// Select + per-option disabled，FormSelect 不支持，故 ALL_VALUE 必须非空）。
export const ALL_VALUE = 'all';

// ── StatusMeta（与 statements/suspense-adjustment 一致）──
export interface StatusMeta {
  tone: string;
  labelKey: string;
}

// ── Badge variant 映射 ──
/**
 * 源用 antd Tag color（processing / success / error / orange），
 * 目标用 Tailwind Badge variant 映射：
 *   processing → warning
 *   success    → success
 *   error      → danger
 *   orange     → warning
 *
 * 直接供 Badge 组件的 variant prop 使用。
 */
export const BADGE_VARIANT_MAP: Record<string, string> = {
  processing: 'warning',
  success: 'success',
  error: 'danger',
  orange: 'warning',
};

/**
 * tone → Tailwind badge class，mmf 模块唯一取色真源。
 *
 * 键覆盖源 antd `<Tag color>` 可能返回的两套色名：
 *   - antd 内置状态色：processing / success / error
 *   - antd 具体色名：red / orange / green / blue / gray
 * approval_task_status_color_* / *_STATUS_COLOR 返回的值均落入此集合；
 * 命中失败回落 default（gray）。
 *
 * detail-page 审批记录与 mmf-status-badge 共用此函数，消除三份重复映射。
 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};
export function statusToneClass(tone: string): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.default;
}

// ── 计提记录状态（accrual list + accrual view 共用，3 个状态）──
export const ACCRUAL_STATUS_COLOR: Record<number, string> = {
  5: 'orange',
  10: 'processing',
  35: 'success',
};

export const ACCRUAL_STATUS_OPTIONS = [
  { value: 5, labelKey: 'status.mmf_distribution_status_5' },
  { value: 10, labelKey: 'status.mmf_distribution_status_10' },
  { value: 35, labelKey: 'status.mmf_distribution_status_35' },
];

export const ACCRUAL_STATUS_PENDING_APPLY = 5;
export const ACCRUAL_STATUS_APPLYING = 10;
export const ACCRUAL_STATUS_APPLIED = 35;

// ── 结算记录状态（settlement list + settlement view 共用，6 个状态）──
export const SETTLEMENT_STATUS_COLOR: Record<number, string> = {
  5: 'orange',
  10: 'processing',
  15: 'error',
  20: 'processing',
  35: 'success',
  40: 'error',
};

export const SETTLEMENT_STATUS_OPTIONS = [
  { value: 5, labelKey: 'status.mmf_settlement_status_5' },
  { value: 10, labelKey: 'status.mmf_settlement_status_10' },
  { value: 15, labelKey: 'status.mmf_settlement_status_15' },
  { value: 20, labelKey: 'status.mmf_settlement_status_20' },
  { value: 35, labelKey: 'status.mmf_settlement_status_35' },
  { value: 40, labelKey: 'status.mmf_settlement_status_40' },
];

export const SETTLEMENT_STATUS_PENDING = 5;
export const SETTLEMENT_STATUS_IN_PROGRESS = 10;
export const SETTLEMENT_STATUS_FAILED = 15;
export const SETTLEMENT_STATUS_PROCESSING = 20;
export const SETTLEMENT_STATUS_COMPLETED = 35;
export const SETTLEMENT_STATUS_REJECTED = 40;

// ── 结算钱包记录状态（settlement view Tab1 子表格，4 个状态，独立枚举）──
export const SETTLEMENT_WALLET_RECORD_STATUS_COLOR: Record<number, string> = {
  20: 'orange',
  30: 'processing',
  35: 'success',
  40: 'error',
};

export const SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS = [
  { value: 20, labelKey: 'status.mmf_settlement_records_status_20' },
  { value: 30, labelKey: 'status.mmf_settlement_records_status_30' },
  { value: 35, labelKey: 'status.mmf_settlement_records_status_35' },
  { value: 40, labelKey: 'status.mmf_settlement_records_status_40' },
];

export const WALLET_RECORD_STATUS_PENDING = 20;
export const WALLET_RECORD_STATUS_PROCESSING = 30;
export const WALLET_RECORD_STATUS_COMPLETED = 35;
export const WALLET_RECORD_STATUS_FAILED = 40;

// ── 审批记录状态（settlement view Tab2）──
/**
 * 审批记录不使用静态 STATUS_COLOR 映射对象。
 * 源代码通过 i18n key 动态拼接取色值与文案：
 *   色值：t(`approval_task_status_color_${state}`)
 *   文案：t(`common_task_status_${state}`)
 *
 * 这是全局 common 约定，属于 shared util-i18n-messages。
 * 若目标项目尚未定义这些 key，需在 common 目录补全（非本模块职责）。
 */

// ── limit 权限码（按钮可见性）──
export const MMF_PERMISSIONS = {
  /** 计提列表「批量申报」按钮 */
  ACCRUAL_BATCH_APPLY_BTN: '395e4d677e6d4275b5b49a172b352676',
  /** 计提列表行「申报(Edit)」操作（仅 status===5 时可用） */
  ACCRUAL_SINGLE_APPLY_BTN: 'fdbee193ff1f4121a37dcea24b7711df',
  /** 计提列表行「查看」 */
  ACCRUAL_VIEW_BTN: '4570f906fddd40c9a2ef38e06e3099df',
  /** 结算列表行「查看」 */
  SETTLEMENT_VIEW_BTN: '49d8f06f484745129a1b36ab47e7c9ac',
  /** 结算详情审批记录行「查看」（跳 /approval-manage/view） */
  SETTLEMENT_RECORD_VIEW_BTN: '3b64dfc2a03e4e159778c2d19cfa4315',
} as const;

// ── transactionType / operationType / dividendMethod i18n key 前缀常量 ──
/** 结算详情 Tab1 钱包记录 transactionType 字段的 i18n key 前缀（相对于 modules.mmf 命名空间）。 */
export const SETTLEMENT_TX_TYPE_KEY_PREFIX = 'status.mmf_settlement_tx_type';
/** 结算详情 Tab2 审批记录 operationType 字段的 i18n key 前缀（相对于 modules.mmf 命名空间）。 */
export const SETTLEMENT_OP_TYPE_KEY_PREFIX = 'status.mmf_settlement_operation_type';

// ── 审批记录跳转 URL（settlement/view Tab2 actions → /approval-manage/view）──
/**
 * 拼接审批记录行「查看」跳转链接。
 *
 * 源 settlement/view.tsx actions → routerPush(`/approval-manage/view?id=${taskId}&busCode=${businessCode}`)。
 * id/busCode 缺失时回退空串，避免拼出 `id=undefined` 的非法 URL。
 */
export function buildApprovalViewUrl(
  taskId: number | undefined | null,
  busCode: string | undefined | null,
): string {
  const id = taskId ?? '';
  const code = busCode ?? '';
  return `/approval-manage/view?id=${id}&busCode=${code}`;
}
