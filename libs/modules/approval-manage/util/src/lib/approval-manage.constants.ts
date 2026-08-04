/**
 * Approval Management 模块常量与枚举/状态码映射。
 *
 * 迁移自 td-manage `src/pages/approval-manage/*`（view.tsx dispatcher + 25 审核组件）。
 * 键值一律照源码 Read 核对（view.tsx:66-89 / index.tsx:22 / 各组件顶部 const）。
 * 全部为纯数据/纯函数，便于单测（jest 仅 util 层可行，见记忆「验证硬限制」）。
 *
 * 设计取舍（Rule 7/8/11）：
 * - `EVENT_TYPE_SOURCE_EVENT_MAP` 与 transaction-event-configuration/util、posting-engine/util
 *   键值相同，但目标库约定为「util 库各自维护一份、不强耦合」（posting-engine 即本地定义），
 *   故此处亦本地定义，保持 approval-manage util 零跨模块依赖。
 * - `getMappingMethodLabel` 取 financial-normalization 全集（3 值：GENERATE/3、DIRECT/1、
 *   CONSTANT/2），posting-rule 仅用 {1,2} 子集——按 Rule 7 取更全集，不平均。
 */

// ── 基础常量 ──────────────────────────────────────────────────────────────────

/** 筛选下拉「全部」占位值（与 wallet / posting-engine / tx-event-config 一致）。 */
export const ALL_VALUE = 'all';

/** 空值占位展示（迁移自源各组件 EMPTY_FIELD_VALUE）。 */
export const EMPTY_FIELD_VALUE = '--';

/** 列表默认每页条数。 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * 「无限大」上限阈值：源 walletType.tsx 用 99999999999 表示透支/利率无上限，展示 ∞。
 * （与 wallet 模块 UNLIMITED_THRESHOLD 同值，此处独立定义以保持本 util 自洽。）
 */
export const INFINITY_AMOUNT = 99999999999;

// ── busCode → type 字典（dispatcher 用 `<map>[busCode]` 查找，键值照 view.tsx:66-89）──

/**
 * TD 主单据操作类型（迁移自 view.tsx:66 tokenType）。
 * busCode → type：td_new=1, td_edit_all=2, td_enable=3, td_disable=4。
 */
export const TOKEN_TYPE: Record<string, number> = {
  td_new: 1,
  td_edit_all: 2,
  td_enable: 3,
  td_disable: 4,
};

/**
 * 钱包类型操作（迁移自 view.tsx:72 walletType）。
 * busCode → type：键值结构与 TOKEN_TYPE 同构，但 busCode 前缀不同，故独立。
 */
export const WALLET_TYPE: Record<string, number> = {
  td_add_wallet_type: 1,
  td_edit_wallet_type: 2,
  td_enable_wallet_type: 3,
  td_disable_wallet_type: 4,
};

/**
 * 监控规则操作（迁移自 view.tsx:78 monitoringRuleType）。
 */
export const MONITORING_RULE_TYPE: Record<string, number> = {
  save_monitoring_rule: 1,
  update_monitoring_rule: 2,
  activate_monitoring_rule: 3,
  deactivate_monitoring_rule: 4,
};

/**
 * 利息规则操作（迁移自 view.tsx:84 interestRuleType）。
 * NOTE: 与前三族不同——此族 activate=3/deactivate=4 顺序与 save/update 一致（非反转），
 * 照源码原样，勿「统一」。
 */
export const INTEREST_RULE_TYPE: Record<string, number> = {
  save_interest_rule: 1,
  update_interest_rule: 2,
  activate_interest_rule: 3,
  deactivate_interest_rule: 4,
};

// ── 列表状态颜色（迁移自 index.tsx:22 approvalStatus）──────────────────────────

/**
 * 列表 Tab1/2 approvalStatus → badge 色调（源 antd Tag color，迁移保留原始色名）。
 * 1=orange(待审批), 2=error(驳回), 3=success(通过)。
 */
export const APPROVAL_STATUS_COLOR: Record<number, string> = {
  1: 'orange',
  2: 'error',
  3: 'success',
};

/**
 * reserve-asset 操作类型展示文案（迁移自 reserve-asset.tsx:30 operateTypeMap）。
 * 源为硬编码英文，照搬（迁移时由组件层决定是否 i18n 化）。
 */
export const OPERATE_TYPE_MAP: Record<number | string, string> = {
  0: 'All',
  1: 'Add',
  2: 'Edit',
  3: 'Activate',
  4: 'Deactivate',
  5: 'Add Asset Category',
};

// ── financial 三级 operationType 推断（合并 coa/normalization/posting，Rule 7 取全集）──

/** operationType 文案枚举（financial-coa / normalization 共用）。 */
export type FinancialOperationType =
  | 'Create'
  | 'Update'
  | 'Edit'
  | 'Activate'
  | 'Deactivate'
  | typeof EMPTY_FIELD_VALUE;

/** COA recordType 优先级映射（迁移自 financial-coa.tsx mapOperationType Priority 1）。 */
const COA_RECORD_TYPE_MAP: Record<number, FinancialOperationType> = {
  1: 'Create',
  2: 'Update',
  3: 'Activate',
  4: 'Deactivate',
};

/** financial-coa 行级变化类型（迁移自 normalizeChanges）。 */
export type CoaRowChangeType = 'Add' | 'Edit' | 'Delete';

/**
 * busCode 字符串 → operationType 推断（合并 normalization 全集，迁移自
 * financial-normalization.tsx:60 getOperationType 的 busCode 段）。
 *
 * normalize 后顺序：update/edit→Edit, activate/enable→Activate,
 * deactivate/disable→Deactivate, create/save→Create。
 */
function inferOperationTypeFromBusCode(
  busCode: string
): FinancialOperationType | undefined {
  if (busCode.includes('update') || busCode.includes('edit')) return 'Edit';
  if (busCode.includes('activate') || busCode.includes('enable'))
    return 'Activate';
  if (busCode.includes('deactivate') || busCode.includes('disable'))
    return 'Deactivate';
  if (busCode.includes('create') || busCode.includes('save')) return 'Create';
  return undefined;
}

/**
 * 统一 operationType 三级推断（合并 financial-coa/normalization/posting 三处实现）。
 *
 * Priority 1：recordType（COA 三级 {3:Activate,4:Deactivate,2:Update,1:Create}；
 *             posting 仅 {2:Update,1:Create} 子集——通过 options.allowActivateDeactivate 收窄）。
 * Priority 2：oldItem/newItem 存在性（仅 COA 用，normalizeChanges 行级）。
 * Priority 3：busCode includes 字符串匹配（normalization 全集）。
 *
 * @param busCode     业务码（可为 undefined）
 * @param recordType  后端显式操作类型
 * @param items       oldItem/newItem 存在性（COA 行级推断用）
 * @param options     allowActivateDeactivate=false 时（posting）屏蔽 Activate/Deactivate，
 *                    仅保留 Update/Create 子集（Rule 7：posting 用 2 态子集，不平均）。
 *
 * 迁移自 financial-coa.tsx:52 mapOperationType + financial-normalization.tsx:60
 * getOperationType + financial-posting-rule.tsx:70 getOperationType。
 */
export function inferOperationType(
  busCode?: string,
  recordType?: number | string,
  items?: { oldItem?: unknown; newItem?: unknown },
  options?: { allowActivateDeactivate?: boolean }
): FinancialOperationType {
  const numericRecordType = Number(recordType);
  const allowActivateDeactivate = options?.allowActivateDeactivate ?? true;

  // Priority 1: recordType（查表；posting 子集屏蔽 Activate/Deactivate）
  if (!Number.isNaN(numericRecordType)) {
    const mapped = COA_RECORD_TYPE_MAP[numericRecordType];
    if (mapped) {
      if (
        allowActivateDeactivate ||
        (mapped !== 'Activate' && mapped !== 'Deactivate')
      ) {
        return mapped;
      }
    }
  }

  // Priority 2: oldItem/newItem 存在性（COA 行级；仅当显式传入 items）
  if (items) {
    const { oldItem, newItem } = items;
    const hasOld = oldItem !== null && oldItem !== undefined;
    const hasNew = newItem !== null && newItem !== undefined;
    if (!hasOld && hasNew) return 'Create';
    if (hasOld && hasNew) return 'Update';
  }

  // Priority 3: busCode includes
  const normalizedBusCode = String(busCode || '').toLowerCase();
  const fromBusCode = inferOperationTypeFromBusCode(normalizedBusCode);
  if (fromBusCode) {
    if (
      !allowActivateDeactivate &&
      (fromBusCode === 'Activate' || fromBusCode === 'Deactivate')
    ) {
      // posting 子集不含 Activate/Deactivate，回退到 Update（含 update/edit）或 Create
      if (normalizedBusCode.includes('update') || normalizedBusCode.includes('edit'))
        return 'Update';
      return 'Create';
    }
    return fromBusCode;
  }

  return EMPTY_FIELD_VALUE;
}

/**
 * COA 行级变化类型（迁移自 financial-coa.tsx normalizeChanges）。
 * oldItem && newItem→Edit，仅 newItem→Add，否则→Delete。
 */
export function inferCoaRowChangeType(
  oldItem?: unknown,
  newItem?: unknown
): CoaRowChangeType {
  const hasOld = oldItem !== null && oldItem !== undefined;
  const hasNew = newItem !== null && newItem !== undefined;
  if (hasOld && hasNew) return 'Edit';
  if (!hasOld && hasNew) return 'Add';
  return 'Delete';
}

// ── financial normalization / posting 共享映射 ─────────────────────────────────

/**
 * sourceEventType 文本键类型（迁移自源 mock.ts SourceEventTypeKey）。
 * 与 tx-event-config util / posting-engine util 同构，本地定义以保持本 util 自洽。
 */
export type SourceEventTypeKey =
  | 'reserveIn'
  | 'mint'
  | 'repositoryOut'
  | 'transfer'
  | 'repositoryIn'
  | 'melt'
  | 'reserveOut'
  | 'fundingIn'
  | 'fundingOut';

/**
 * eventType → sourceEventType 文本键（合并 financial-normalization.tsx:28 与
 * financial-posting-rule.tsx:31 两处重复定义，键值完全相同）。
 */
export const EVENT_TYPE_SOURCE_EVENT_MAP: Record<number, SourceEventTypeKey> = {
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
 * normalization 映射字段 → i18n label key（迁移自 financial-normalization.tsx:40
 * FIELD_LABEL_KEY_MAP，15 项，与后端 targetField 强耦合）。
 */
export const FIELD_LABEL_KEY_MAP: Record<string, string> = {
  UniversalTransactionIdentifier: 'financial_0294',
  UserUniversalIdentifier: 'financial_0295',
  TokenName: 'financial_0004',
  TransactionDate: 'financial_0296',
  ValueDate: 'financial_0297',
  FinalityDate: 'financial_0317',
  OrganizationCode: 'financial_0315',
  TokenType: 'financial_0219',
  Blockchain: 'PUB_Blockchain',
  From: 'financial_0021',
  To: 'financial_0022',
  TransactionAmount: 'financial_0298',
  TransactionHash: 'financial_0023',
  TransactionTime: 'financial_0299',
  Status: 'PUB_Status',
};

/**
 * mappingMethod → i18n label key（取 normalization 全集，Rule 7）。
 * GENERATE/3→financial_0208, DIRECT/1→financial_0161, CONSTANT/2→financial_0209。
 * （posting-rule 源仅 {1,2} 子集，此处超集覆盖，调用方无须区分。）
 */
export function getMappingMethodLabelKey(
  mappingMethod?: number | string
): string | undefined {
  const normalized =
    typeof mappingMethod === 'string'
      ? mappingMethod.trim().toUpperCase()
      : mappingMethod;

  if (normalized === 'GENERATE' || mappingMethod === 3) return 'financial_0208';
  if (normalized === 'DIRECT' || mappingMethod === 1) return 'financial_0161';
  if (normalized === 'CONSTANT' || mappingMethod === 2) return 'financial_0209';
  return undefined;
}

/** 借贷方向（迁移自 financial-posting-rule.tsx:94 getDirectionLabel）。1=Dr, 2=Cr。 */
export function getDirectionLabel(direction?: number | string): string {
  if (Number(direction) === 1) return 'Dr';
  if (Number(direction) === 2) return 'Cr';
  return EMPTY_FIELD_VALUE;
}

// ── serviceProvider 枚举（迁移自 serviceProvider.tsx:21-36）────────────────────

/** 对账频率（RECONCILIATION_LABEL_MAP，硬编码英文，源为展示文案）。 */
export const RECONCILIATION_LABEL_MAP: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

/** 私钥托管选项（PRIVATE_KEY_CUSTODY_OPTIONS，复用 tokenized-deposit/key-management 语义）。 */
export const PRIVATE_KEY_CUSTODY_OPTIONS = [
  { value: '1', label: 'Issuer Custody' },
  { value: '2', label: 'SP Custody' },
  { value: '3', label: 'Self-Custody (End User)' },
] as const;

/** 交易策略选项（TRANSACTION_POLICY_OPTIONS）。 */
export const TRANSACTION_POLICY_OPTIONS = [
  { value: '1', label: 'Via Current SP' },
  { value: '2', label: 'Direct (End User)' },
] as const;

// ── interest-rule 计息日序数词（迁移自 interest-rule.tsx:172-200）────────────────

/** 计息日序数词 i18n key 映射（1/21/31→00128, 2/22→00129, 3/23→00130, 其余→00131）。 */
export function getCalculateDayOrdinalKey(day?: number | null): string {
  const d = Number(day);
  if (d === 1 || d === 21 || d === 31) return 'interest_00128';
  if (d === 2 || d === 22) return 'interest_00129';
  if (d === 3 || d === 23) return 'interest_00130';
  return 'interest_00131';
}

// ── reserve-asset-transaction 方向（迁移自 reserve-asset-transaction.tsx）────────

/** 资金方向：1→Inflow，其余→Outflow（源用 transactionDirection 判断红绿）。 */
export function getTransactionDirection(
  direction?: number | null
): 'Inflow' | 'Outflow' {
  return Number(direction) === 1 ? 'Inflow' : 'Outflow';
}

// ── 审批日志 Steps status（迁移自 view.tsx Steps.status 判定）────────────────────

/**
 * Steps.status：3/15/40→'error'，其余→'process'（迁移自 view.tsx 审批日志步骤条）。
 */
export function resolveApprovalStepStatus(status?: number): 'error' | 'process' {
  return status === 3 || status === 15 || status === 40 ? 'error' : 'process';
}

// ── 权限 UUID（迁移自源 actions.limit，TDManage userPermission 校验）──────────────

/**
 * Approval 权限 UUID（TDManage 环境下用于 `userPermission` 校验）。
 *
 * 用于 `useAuth().permissions` 的可见性判断；权限未配置（空集）时全放开，
 * 等价于源项目非 TDManage 环境（同 wallet / posting-engine / journal-entries 模式）。
 *
 * - View → 列表行 Detail（源 index.tsx 三个 Tab 的 `View` limit）
 * - Withdraw → Tab3 Withdrawal（源 index.tsx Tab3 的 `Withdrawal` limit）
 *
 * NOTE: 值必须与后端下发的权限码（旧 UUID 格式）一致；早先用语义化字符串
 * `'approval-manage:view'` 会导致 `.has()` 永不命中、actions 列全显示 `--`。
 */
export const APPROVAL_PERMISSIONS = {
  View: '82536c63366b40a586774192751e7060',
  Withdraw: '5f1c684ec8374caf9a8d5e4b1f26796a',
} as const;

// ── 动态 i18n key 前缀（§6.1 全集，确保 namespace 含词条，渲染时 `t(prefix + n)`）──

/**
 * 审批中心消费的动态 i18n key 前缀全集（§6.1）。
 *
 * 这些前缀在组件层以 `t(`${prefix}${value}`)` 拼接消费，后端返回的数值/枚举决定具体词条。
 * 收敛 namespace 时必须确保每个前缀下的词条齐全，否则渲染原始 key 字符串（MISSING_MESSAGE）。
 * 列于此处供 i18n 词条完整性自检（阶段五 grep 拦截）。
 */
export const DYNAMIC_I18N_KEY_PREFIXES = [
  'token_type_',
  'common_task_status_',
  'common_approval_status_',
  'approval_task_status_color_',
  'service_provider_type_',
  'service_provider_types_',
  'admin_wallet_type_',
  'user_wallet_task_type_',
  'funds_task_type_',
  'wallet_type_task_type_',
  'td_operation_type_edit_',
  'monitoring_rule_type_',
  'transaction_monitoring_type_',
  'risk_level_type_',
  'risk_level_color_',
  'rule_action_',
  'suggested_action_type_',
  'interest_operation_type_',
  'interest_account_type_',
  'interest_list_feeType_',
  'token_pair_operation_type_',
  'liquidity_pool_operation_type_',
  'mmf_settlement_operation_type_',
  'mmf_fund_type_',
  'mmf_risk_level_',
  'maintenance_fee_call_type_',
  'blockchain_code_color_',
  'approve_type_',
] as const;
