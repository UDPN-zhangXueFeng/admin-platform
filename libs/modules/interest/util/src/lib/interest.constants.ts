/**
 * Interest 模块常量：状态映射 / 枚举 / 权限码 / ALL_VALUE。
 *
 * labelKey 使用相对 key（不带 `modules.interest.` 前缀），避免 i18n 双重前缀 → MISSING_MESSAGE。
 * ALL_VALUE 必须非空（'all' 非 ''），否则 Radix SelectItem 崩溃。
 */

// ── 策略状态（两处 approvalTaskStatus 合并）─────────────────────────────────
// 源：policy/index.tsx:19 + policy/view.tsx:17，键值完全相同
export const POLICY_STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'interest_status_1', color: 'processing' },   // Processing
  5: { label: 'interest_status_5', color: 'gray' },          // Unactivated
  10: { label: 'interest_status_10', color: 'success' },     // Active
  15: { label: 'interest_status_15', color: 'gray' },        // Inactive
};

export const POLICY_STATUS_OPTIONS = [
  { value: '', label: 'PUB_All' },
  { value: '1', label: 'interest_status_1' },
  { value: '5', label: 'interest_status_5' },
  { value: '10', label: 'interest_status_10' },
  { value: '15', label: 'interest_status_15' },
];

// ── 交易状态（transactions/index.tsx 8 态，45=Deleted 注释不展示）────────────
// 颜色从 common namespace `approval_task_status_color_${status}` 取值
export const TRANSACTION_STATUS_MAP: Record<number, string> = {
  1: 'interest_list_transaction_status_1',   // Pending Posting
  5: 'interest_list_transaction_status_5',   // Pending Approval
  10: 'interest_list_transaction_status_10', // Under Approval
  15: 'interest_list_transaction_status_15', // Rejected
  20: 'interest_list_transaction_status_20', // Approved
  30: 'interest_list_transaction_status_30', // Processing
  35: 'interest_list_transaction_status_35', // Success
  40: 'interest_list_transaction_status_40', // Failed
  // 45: 'interest_list_transaction_status_45', // Deleted — 源码注释掉，保留注释
};

export const TRANSACTION_STATUS_OPTIONS = [
  { value: '', label: 'PUB_All' },
  { value: '1', label: 'interest_list_transaction_status_1' },
  { value: '5', label: 'interest_list_transaction_status_5' },
  { value: '10', label: 'interest_list_transaction_status_10' },
  { value: '15', label: 'interest_list_transaction_status_15' },
  { value: '20', label: 'interest_list_transaction_status_20' },
  { value: '30', label: 'interest_list_transaction_status_30' },
  { value: '35', label: 'interest_list_transaction_status_35' },
  { value: '40', label: 'interest_list_transaction_status_40' },
];

// ── 计息类型（feeType）──────────────────────────────────────────────────────
export const FEE_TYPE_MAP: Record<number, string> = {
  50: 'interest_list_feeType_50', // Deposit Interest
  60: 'interest_list_feeType_60', // Overdraft Interest
};

export const FEE_TYPE_OPTIONS = [
  { value: '', label: 'PUB_All' },
  { value: '50', label: 'interest_list_feeType_50' },
  { value: '60', label: 'interest_list_feeType_60' },
];

// ── 账户类型（accountType）──────────────────────────────────────────────────
export const ACCOUNT_TYPE_MAP: Record<number, string> = {
  1: 'interest_account_type_1', // Current account
  2: 'interest_account_type_2', // Savings account
};

// ── 计息计算方法 ────────────────────────────────────────────────────────────
export const CALCULATION_METHOD_MAP: Record<number, string> = {
  1: 'interest_method_1', // Whole Balance Method
  2: 'interest_method_2', // Partial Balance Method
};

// ── 操作类型（operation records）────────────────────────────────────────────
export const OPERATION_TYPE_MAP: Record<number, string> = {
  1: 'interest_operation_type_1', // Add
  2: 'interest_operation_type_2', // Edit
  3: 'interest_operation_type_3', // Activate
  4: 'interest_operation_type_4', // Deactivate
};

export const OPERATION_TYPE_OPTIONS = [
  { value: '', label: 'PUB_All' },
  { value: '1', label: 'interest_operation_type_1' },
  { value: '2', label: 'interest_operation_type_2' },
  { value: '3', label: 'interest_operation_type_3' },
  { value: '4', label: 'interest_operation_type_4' },
];

// ── ALL_VALUE（必须非空，否则 Radix SelectItem 崩溃）────────────────────────
export const ALL_VALUE = 'all';

// ── 权限码（共 10 个）───────────────────────────────────────────────────────
export const INTEREST_PERMISSIONS = {
  CREATE_POLICY: '1533a5824226411c902baf02a632b56f',
  VIEW_POLICY: 'a572edeedf814f4fca76e40acf822c11b',
  EDIT_POLICY: '7d94af987806492b8c2dbe604847da6e',
  DISABLE_POLICY: '5bf84826d7da49a6a0a650613935d32c',
  ENABLE_POLICY: 'a6fc701d44f94121b0b9d0dcc698cea7',
  VIEW_ACCRUAL: 'cdd57472f91e449fac71b6372fd38aa2',
  VIEW_TRANSACTION: 'b1bd494af08a49dabf9aa7b9cabcd954',
  POST_TRANSACTION: '6975b7173e03428aa538cb923cdf1ba5',
  RETRY_TRANSACTION: '73ea065245de44d5bc66ded0c7a2295b',
  VIEW_APPROVAL: 'e338a3b41c21413db1d2ac7a90a65f5f',
} as const;

// ── 利率校验正则（最多 2 位小数）────────────────────────────────────────────
export const INTEREST_RATE_PATTERN = /^[0-9]+(\.[0-9]{1,2})?$/;

// ── 频率常量（表单 disabled Input 的值）─────────────────────────────────────
export const FREQUENCY_DAILY = 'Daily';       // i18n: interest_00123
export const FREQUENCY_MONTHLY = 'Monthly';   // i18n: interest_00124

// ── 分段利率最多行数 ────────────────────────────────────────────────────────
export const MAX_SAVE_DETAILS_ROWS = 10;
