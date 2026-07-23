/**
 * busCode → 审核组件映射（dispatcher 事实源）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/view.tsx:513-660` 的 dispatcher if-else 长链。
 * 该长链是 view.tsx 的核心：读 URL `?busCode=`，按 busCode 分发到 25 个审核组件之一。
 *
 * 结构设计（便于 dispatcher 消费）：
 * - `BUS_CODE_MAP`：精确匹配查表（44 个 busCode，O(1)），含组件标识 + 可选 type。
 * - `FINANCIAL_FUZZY_MATCHERS`：4 组 financial 模糊匹配有序数组（顺序敏感，精确匹配之后兜底）。
 *
 * NOTE: 审核组件尚未迁移（feature 层后续任务），此处用字符串组件标识符引用，
 * dispatcher（feature 层）负责把标识符映射到实际 React 组件。这样 util 零 UI 依赖、可单测。
 *
 * 键值/type 照源码 view.tsx dispatcher 逐一核对（Rule 12）。
 */

import {
  INTEREST_RULE_TYPE,
  MONITORING_RULE_TYPE,
  TOKEN_TYPE,
  WALLET_TYPE,
} from './approval-manage.constants';

// ── 审核组件标识符（与 feature 层 components/ 目录 1:1）──────────────────────────

/**
 * 审核组件标识符。对应 feature 层 `components/<域>/<组件>` 的导出名。
 * dispatcher 用此 key 从组件注册表取出实际 React 组件渲染。
 */
export type ApprovalComponentKey =
  | 'token' // TokenApproval（TD 主单据 Create/Update/Enable/Disable）
  | 'mint' // MintApproval（增发）
  | 'melt' // MeltApproval（销毁）
  | 'updateAdminWallet' // UpdateAdminWalletApproval
  | 'walletType' // WalletTypeApproval（钱包类型 Create/Update/Enable/Disable + MMF 分支）
  | 'updateWalletType' // UpdateWalletTypeApproval（SP 钱包类型变更）
  | 'userWallet' // UserWalletApproval（冻结/解冻）
  | 'funds' // FundsApproval（资金冻结/解冻 TD）
  | 'createWallet' // CreateWalletApproval（用户钱包新建）
  | 'serviceProvider' // ServiceProviderApproval（SP 注册/编辑）
  | 'topUp' // TopUpApproval（稳定币充值/铸造）
  | 'withdrawal' // WithdrawalApproval（稳定币提现/赎回/销毁）
  | 'monitoringRule' // MonitoringRuleApproval
  | 'monitoringResultProcess' // MonitoringResultProcessApproval
  | 'interestRule' // InterestRuleTypeApproval
  | 'interestFee' // InterestFeeApproval
  | 'tokenPair' // TokenPairApproval
  | 'liquidityPool' // LiquidityPoolApproval
  | 'settlement' // SettlementApproval（MMF settlement）
  | 'reserveAsset' // ReserveAssetApproval
  | 'reserveAssetTransaction' // ReserveAssetTransactionApproval
  | 'financialCoa' // FinancialCoaApproval
  | 'financialNormalization' // FinancialNormalizationApproval
  | 'financialPostingRule' // FinancialPostingRuleApproval
  | 'financialSuspenseAdjustment'; // FinancialSuspenseAdjustmentApproval（唯一调 API）

/** 精确匹配条目：组件标识 + 可选 type（busCode 派生的操作类型）。 */
export interface BusCodeEntry {
  /** 审核组件标识符。 */
  component: ApprovalComponentKey;
  /**
   * 操作类型（可选）。部分组件用 type 区分 Create/Update/Enable/Disable 等子语义，
   * 由 busCode 派生（照 view.tsx dispatcher 的 `type={...}` 表达式）。
   * 未设置表示该 busCode 不区分子类型。
   */
  type?: number;
  /**
   * 备注（迁移用，记录 dispatcher 对该 busCode 的特殊处理，如 status 字段来源）。
   */
  note?: string;
}

// ── 精确匹配表（44 个 busCode，迁移自 view.tsx:513-618）──────────────────────────

/**
 * busCode → 审核组件精确映射表。
 *
 * 总数：44（迁移前 grep view.tsx dispatcher 核对：td_new/td_edit_all/td_disable/td_enable/
 * td_admin_wallet_update/td_mint/td_melt/sp_buy_token/sp_withdraw_token/
 * td_add_wallet_type/td_edit_wallet_type/td_disable_wallet_type/td_enable_wallet_type/
 * td_freeze_wallet/td_unfreeze_wallet/sp_open_wallet/td_freeze_wallet_td/
 * td_unfreeze_wallet_td/td_change_wallet_type/td_register_sp/td_edit_sp/
 * save_monitoring_rule/update_monitoring_rule/deactivate_monitoring_rule/
 * activate_monitoring_rule/token_monitoring_result_process/save_interest_rule/
 * update_interest_rule/activate_interest_rule/deactivate_interest_rule/
 * approve_interest_fee/save_token_pair/update_token_pair/activate_token_pair/
 * deactivate_token_pair/save_liquidity_pool/update_liquidity_pool/apply_mmf_settlement/
 * save_reserve_asset/save_reserve_asset_category/update_reserve_asset/
 * activate_reserve_asset/deactivate_reserve_asset/save_reserve_asset_transaction）。
 *
 * type 来源：
 * - token/walletType/monitoringRule/interestRule：照 TOKEN_TYPE/WALLET_TYPE/
 *   MONITORING_RULE_TYPE/INTEREST_RULE_TYPE 字典（与源 dispatcher `type={map[busCode]}` 一致）。
 * - userWallet/funds/serviceProvider 的 type：照源 dispatcher 三元表达式（freeze→1, else→2）。
 */
export const BUS_CODE_MAP: Record<string, BusCodeEntry> = {
  // ── tokenized-deposit（4）── type 由 TOKEN_TYPE 派生
  td_new: { component: 'token', type: TOKEN_TYPE.td_new, note: 'status 取 applyStatus' },
  td_edit_all: {
    component: 'token',
    type: TOKEN_TYPE.td_edit_all,
    note: 'status 取 operateStatus',
  },
  td_enable: { component: 'token', type: TOKEN_TYPE.td_enable },
  td_disable: { component: 'token', type: TOKEN_TYPE.td_disable },
  // ── tokenized-deposit mint/melt（2）── 无 type
  td_mint: { component: 'mint' },
  td_melt: { component: 'melt' },
  // ── admin wallet（1）── 无 type
  td_admin_wallet_update: { component: 'updateAdminWallet' },
  // ── wallet type（4）── type 由 WALLET_TYPE 派生
  td_add_wallet_type: { component: 'walletType', type: WALLET_TYPE.td_add_wallet_type },
  td_edit_wallet_type: {
    component: 'walletType',
    type: WALLET_TYPE.td_edit_wallet_type,
  },
  td_enable_wallet_type: {
    component: 'walletType',
    type: WALLET_TYPE.td_enable_wallet_type,
  },
  td_disable_wallet_type: {
    component: 'walletType',
    type: WALLET_TYPE.td_disable_wallet_type,
  },
  // ── user wallet 冻结/解冻（2）── type: freeze→1, else→2
  td_freeze_wallet: { component: 'userWallet', type: 1, note: 'status 取 status 字段' },
  td_unfreeze_wallet: {
    component: 'userWallet',
    type: 2,
    note: 'status 取 status 字段',
  },
  // ── create wallet（1）── 无 type
  sp_open_wallet: { component: 'createWallet', note: 'status 取 status 字段' },
  // ── funds 冻结/解冻 TD（2）── type: freeze_td→1, else→2
  td_freeze_wallet_td: {
    component: 'funds',
    type: 1,
    note: '冻结 TD 资金；status 取 status 字段',
  },
  td_unfreeze_wallet_td: {
    component: 'funds',
    type: 2,
    note: '解冻 TD 资金；status 取 status 字段',
  },
  // ── update wallet type（1）── 无 type
  td_change_wallet_type: { component: 'updateWalletType' },
  // ── service provider 注册/编辑（2）── type: register→1, else→2
  td_register_sp: { component: 'serviceProvider', type: 1 },
  td_edit_sp: { component: 'serviceProvider', type: 2 },
  // ── 稳定币充值/提现（2）── 无 type
  sp_buy_token: { component: 'topUp', note: '稳定币充值/铸造；status 取 status 字段' },
  sp_withdraw_token: {
    component: 'withdrawal',
    note: '稳定币提现/赎回；status 取 status 字段',
  },
  // ── monitoring rule（4）── type 由 MONITORING_RULE_TYPE 派生
  save_monitoring_rule: {
    component: 'monitoringRule',
    type: MONITORING_RULE_TYPE.save_monitoring_rule,
  },
  update_monitoring_rule: {
    component: 'monitoringRule',
    type: MONITORING_RULE_TYPE.update_monitoring_rule,
  },
  activate_monitoring_rule: {
    component: 'monitoringRule',
    type: MONITORING_RULE_TYPE.activate_monitoring_rule,
  },
  deactivate_monitoring_rule: {
    component: 'monitoringRule',
    type: MONITORING_RULE_TYPE.deactivate_monitoring_rule,
  },
  // ── monitoring result process（1）── 无 type
  token_monitoring_result_process: { component: 'monitoringResultProcess' },
  // ── interest rule（4）── type 由 INTEREST_RULE_TYPE 派生
  save_interest_rule: {
    component: 'interestRule',
    type: INTEREST_RULE_TYPE.save_interest_rule,
  },
  update_interest_rule: {
    component: 'interestRule',
    type: INTEREST_RULE_TYPE.update_interest_rule,
  },
  activate_interest_rule: {
    component: 'interestRule',
    type: INTEREST_RULE_TYPE.activate_interest_rule,
  },
  deactivate_interest_rule: {
    component: 'interestRule',
    type: INTEREST_RULE_TYPE.deactivate_interest_rule,
  },
  // ── interest fee（1）── 无 type
  approve_interest_fee: { component: 'interestFee' },
  // ── token pair（4）── 无 type，recordType 驱动
  save_token_pair: { component: 'tokenPair' },
  update_token_pair: { component: 'tokenPair' },
  activate_token_pair: { component: 'tokenPair' },
  deactivate_token_pair: { component: 'tokenPair' },
  // ── liquidity pool（2）── 无 type，operationType 驱动
  save_liquidity_pool: { component: 'liquidityPool' },
  update_liquidity_pool: { component: 'liquidityPool' },
  // ── settlement（1）── 无 type，固定 Create
  apply_mmf_settlement: { component: 'settlement' },
  // ── reserve asset（5）── opType 来自 URL query.opType（非 busCode 派生！）
  // NOTE: dispatcher 把 query.opType 透传给 ReserveAssetApproval 的 opType prop，
  // 与其他族「type 由 busCode 派生」不同。此处仅记录组件，opType 由调用方从 query 取。
  save_reserve_asset: {
    component: 'reserveAsset',
    note: 'opType 来自 URL query.opType；operateType 展示由 detailInfo.operateType 经 OPERATE_TYPE_MAP 映射',
  },
  save_reserve_asset_category: {
    component: 'reserveAsset',
    note: 'opType 来自 URL query.opType',
  },
  update_reserve_asset: {
    component: 'reserveAsset',
    note: 'opType 来自 URL query.opType',
  },
  activate_reserve_asset: {
    component: 'reserveAsset',
    note: 'opType 来自 URL query.opType',
  },
  deactivate_reserve_asset: {
    component: 'reserveAsset',
    note: 'opType 来自 URL query.opType',
  },
  // ── reserve asset transaction（1）── 无 type
  save_reserve_asset_transaction: { component: 'reserveAssetTransaction' },
};

// ── 4 组 financial 模糊匹配（顺序敏感，精确匹配后兜底）──────────────────────────

/** 模糊匹配谓词：接收原始 busCode，返回是否命中。 */
export type BusCodeMatcher = (busCode: string) => boolean;

/** 模糊匹配条目：谓词 + 命中组件 + 备注。 */
export interface FuzzyBusCodeMatcher {
  /** 唯一标识（文档/日志用）。 */
  id: string;
  /** 匹配谓词。 */
  matches: BusCodeMatcher;
  /** 命中后渲染的组件。 */
  component: ApprovalComponentKey;
  /** 备注（迁移用）。 */
  note?: string;
}

/**
 * financial 模糊匹配有序数组。
 *
 * ⚠️ 顺序敏感：dispatcher 必须在精确匹配（BUS_CODE_MAP）之后才进入此数组，
 * 且按数组顺序短路（命中即返回）。
 *
 * 迁移自 view.tsx:488-504 + 642-660。源用 4 个 boolean 派生：
 * - isFinancialNormalizationApproval: startsWith('fin_normalization_') || includes('normalization') || includes('mapping')
 * - isFinancialPostingRuleApproval: includes('posting')
 * - isFinancialSuspenseAdjustmentApproval: includes('suspense') && includes('adjust')
 * - FinancialCoa: 精确匹配后兜底 startsWith('fin_coa_')（view.tsx:642）
 *
 * 顺序决策：coa 的 startsWith('fin_coa_') 最特化（前缀锚定）放首；
 * normalization 三条件之一即可命中，放次；posting includes('posting') 过宽（文档标注收窄风险），
 * 放第三；suspense && adjust 双条件最严格放末。与源 dispatcher 渲染顺序一致
 * （coa→normalization→posting→suspense 在 view.tsx:642/624/628/632 依次出现）。
 */
export const FINANCIAL_FUZZY_MATCHERS: readonly FuzzyBusCodeMatcher[] = [
  {
    id: 'fin-coa',
    matches: (busCode) => busCode.startsWith('fin_coa_'),
    component: 'financialCoa',
    note: 'mapOperationType 三级推断（inferOperationType）',
  },
  {
    id: 'fin-normalization',
    matches: (busCode) =>
      busCode.startsWith('fin_normalization_') ||
      busCode.includes('normalization') ||
      busCode.includes('mapping'),
    component: 'financialNormalization',
    note: '5 props 全传（detailInfo/approvalInfo/taskInfo/approvalStatus/busCode）',
  },
  {
    id: 'fin-posting-rule',
    matches: (busCode) => busCode.includes('posting'),
    component: 'financialPostingRule',
    note: '⚠️ 判定过宽（含 posting 的其他 busCode 会误命中），迁移路由收窄为 startsWith("fin_posting_")',
  },
  {
    id: 'fin-suspense-adjustment',
    matches: (busCode) => busCode.includes('suspense') && busCode.includes('adjust'),
    component: 'financialSuspenseAdjustment',
    note: '仅传 detailInfo；唯一调 API（fetchSuspenseAdjustmentDetail）',
  },
];

// ── dispatcher 查询 API（纯函数，供 feature 层 dispatcher 消费）──────────────────

/** dispatcher 解析结果：命中组件 + 可选 type + 是否模糊匹配命中。 */
export interface ResolvedApprovalComponent {
  /** 审核组件标识符。 */
  component: ApprovalComponentKey;
  /** 操作类型（可选，仅精确匹配的族有）。 */
  type?: number;
  /** 是否由模糊匹配命中（false=精确匹配）。 */
  fuzzy?: boolean;
  /** 备注（透传 entry.note）。 */
  note?: string;
}

/**
 * 按 busCode 解析审核组件（dispatcher 事实源）。
 *
 * 顺序：① 精确匹配 BUS_CODE_MAP（O(1)）→ ② FINANCIAL_FUZZY_MATCHERS 有序数组短路。
 * 精确匹配优先于模糊匹配（否则 financial busCode 可能被模糊规则提前截获）。
 *
 * @param busCode  原始 busCode（未 normalize）
 * @returns        命中条目；未命中返回 null（dispatcher 应渲染兜底/空态）
 */
export function resolveApprovalComponent(
  busCode?: string | null
): ResolvedApprovalComponent | null {
  if (!busCode) return null;
  const normalized = String(busCode);

  // ① 精确匹配
  const exact = BUS_CODE_MAP[normalized];
  if (exact) {
    return {
      component: exact.component,
      type: exact.type,
      fuzzy: false,
      note: exact.note,
    };
  }

  // ② 模糊匹配（顺序敏感，短路）
  for (const matcher of FINANCIAL_FUZZY_MATCHERS) {
    if (matcher.matches(normalized)) {
      return { component: matcher.component, fuzzy: true, note: matcher.note };
    }
  }

  return null;
}

/** 便捷：busCode 是否命中 reserve asset 族（需从 query.opType 取 opType，特殊处理）。 */
export function isReserveAssetBusCode(busCode?: string | null): boolean {
  if (!busCode) return false;
  const entry = BUS_CODE_MAP[String(busCode)];
  return entry?.component === 'reserveAsset';
}
