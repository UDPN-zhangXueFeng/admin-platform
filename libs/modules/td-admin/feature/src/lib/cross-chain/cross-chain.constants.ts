/**
 * Cross-chain 模块枚举常量、状态映射与权限码。
 *
 * 迁移自 td-manage cross-chain 模块（5 子模块）。
 * 状态/类型文案全部走 i18n key 动态拼接（非静态对象字面量）。
 * 权限码控制按钮可见性，共 18 个 hash。
 */

// ── 通用 ──
export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';

// ── 1) Cross-Chain Transaction 状态色枚举 ──
// source: cross-chain-transactions/index.tsx:18 & view.tsx:9
export const CROSS_CHAIN_TX_STATUS_COLOR = {
  20: 'orange',
  30: 'processing',
  35: 'success',
  40: 'error',
} as const;

// ── 2) Liquidity Pool 状态色枚举 ──
// source: liquidity-pool/index.tsx:21 & view.tsx:15
export const LIQUIDITY_POOL_STATUS_COLOR = {
  0: 'default',
  5: 'success',
  1: 'processing',
} as const;

// ── 3) Liquidity Pool Transaction 状态色枚举 ──
// source: liquidity-pool/view.tsx:20（源码名 liquidityPooTTransactionStstus，纠正命名保留语义）
export const LIQUIDITY_POOL_TX_STATUS_COLOR = {
  30: 'processing',
  35: 'success',
  40: 'error',
  50: 'error',
} as const;

// ── 4) RD Bridge 状态色枚举 ──
// source: rd-bridge/index.tsx:19 & view.tsx:17
export const RD_BRIDGE_STATUS_COLOR = {
  35: 'success',
  50: 'gray',
} as const;

// ── 5) Token Pair 状态色枚举 ──
// source: token-pair/index.tsx:18 & view.tsx:14
export const TOKEN_PAIR_STATUS_COLOR = {
  1: 'processing',
  3: 'gray',
  5: 'success',
  10: 'gray',
} as const;

// ── i18n key 前缀常量（动态拼接用）──
// 注意：LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX 保留源项目拼写错误 "ststus"，勿纠正，
// 否则与翻译文件 key 不匹配导致文案缺失。

/** Cross-Chain Transaction 状态 label key 前缀 */
export const CROSS_CHAIN_TX_STATUS_LABEL_KEY_PREFIX =
  'cross_chain_transactions_status_';

/** Liquidity Pool 状态 label key 前缀 */
export const LIQUIDITY_POOL_STATUS_LABEL_KEY_PREFIX = 'liquidity_pool_status_';

/** Liquidity Pool Transaction 状态 label key 前缀（保留源拼写错误 ststus） */
export const LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX =
  'liquidity_pool_transaction_ststus_';

/** RD Bridge 状态 label key 前缀 */
export const RD_BRIDGE_STATUS_LABEL_KEY_PREFIX = 'cross_chain_status_';

/** Token Pair 状态 label key 前缀 */
export const TOKEN_PAIR_STATUS_LABEL_KEY_PREFIX = 'token_pair_status_';

/** 区块链色块 key 前缀（复用 common/router namespace 的 blockchain_code_color_*） */
export const BLOCKCHAIN_CODE_COLOR_KEY_PREFIX = 'blockchain_code_color_';

// ── 启停状态常量（update 接口传值语义，与列表显示值不同）──
// 注：RD Bridge 列表 status=35 表示启用中(可禁)，50 表示禁用(可启用)；
//     Token Pair 列表 status=1(processing)/3(gray)/5(success=启用)/10(gray=禁用)。
//     此处的 ENABLE/DISABLE 是 update 接口入参，固定为 35/50。

/** RD Bridge 启停状态 update 入参 */
export const RD_BRIDGE_STATE = {
  /** 启用 */
  ENABLE: 35,
  /** 禁用 */
  DISABLE: 50,
} as const;

/** Token Pair 启停状态 update 入参 */
export const TOKEN_PAIR_UPDATE_STATE = {
  /** 启用 */
  ENABLE: 35,
  /** 禁用 */
  DISABLE: 50,
} as const;

// ── 权限码（18 个 hash，控制按钮可见性）──
// source: 各子模块 index.tsx 中 limit/Access 标识符
// 注意：670504d5c9ae48afb4504f97c12450e6 在 cross-chain-transactions 中为已注释的
// Refund 死代码权限码，但在 token-pair 的 Enable 按钮中实际复用，必须保留勿删。

export const CROSS_CHAIN_PERMISSIONS = {
  // ---- cross-chain-transactions 子模块 ----
  /** 交易列表 查看按钮 */
  CCT_VIEW_BTN: '48414a6283914f03bc6b16f3e1c91f30',

  // ---- fx-rate 子模块 ----
  /** 汇率列表行「查看」按钮（跳详情页 view?rateId=） */
  FX_RATE_VIEW_BTN: '2ba9e846da974e3895b2bed3bddce9db',

  // ---- liquidity-pool 子模块 ----
  /** 流动性池 新建按钮 */
  LP_ADD_BTN: '414f3bd435b941eeb873d5ea50263dfa',
  /** 流动性池 查看按钮 */
  LP_VIEW_BTN: 'd84423b56a0a422bbcb1597960a5011c',
  /** 流动性池 编辑按钮 */
  LP_EDIT_BTN: '72711b9dd25e4d90abb95605ee037b9a',
  /** 流动性池 重新授权按钮 */
  LP_REAUTHORIZE_BTN: '4dfc6f2893f24ccd981950ff5f723f7e',
  /** 流动性池 转出按钮 */
  LP_TRANSFER_OUT_BTN: 'a462efc14ddd401d8ea06028c83b453f',

  // ---- rd-bridge 子模块 ----
  /** RD Bridge 新建按钮 */
  RD_ADD_BTN: '6c7b7ced88c849a28cdd3ae1bbd43729',
  /** RD Bridge 查看按钮 */
  RD_VIEW_BTN: '7b09808a65994948843124b2dcf90a5c',
  /** RD Bridge 编辑按钮 */
  RD_EDIT_BTN: '7bc9b74a58654aa88ac7b2f6b1dbbf57',
  /** RD Bridge 禁用按钮 */
  RD_DISABLE_BTN: '5e0aff44aff047c48af9c707f31c6c50',
  /** RD Bridge 启用按钮 */
  RD_ENABLE_BTN: 'cba987d291d2487b95de872c996115e4',

  // ---- token-pair 子模块 ----
  /** Token Pair 新建按钮 */
  TP_ADD_BTN: 'f4880fa61c914180a054032fafbd1908',
  /** Token Pair 查看按钮 */
  TP_VIEW_BTN: 'cf368f08de3446a29f75441f6aba0e36',
  /** Token Pair 编辑按钮 */
  TP_EDIT_BTN: 'f21920aa8dc342aebec361392cde8d01',
  /** Token Pair 禁用按钮 */
  TP_DISABLE_BTN: 'a2b3704470444a778d4a07eb9265679d',
  /** Token Pair 启用按钮（与 CCT Refund 死代码相同 hash 值） */
  TP_ENABLE_BTN: '670504d5c9ae48afb4504f97c12450e6',

  // ---- 通用：详情页操作记录行「查看」按钮（3 个详情页共用同一 hash）----
  // source: rd-bridge/view.tsx + liquidity-pool/view.tsx + token-pair/view.tsx 的
  // 操作记录行 View 按钮 limit 字段，同一 hash 值。
  // - rd-bridge/view: 弹 Drawer（getCrossChainRecordDetail）
  // - liquidity-pool/view & token-pair/view: 跳 /approval-manage/view
  OP_RECORD_VIEW_BTN: 'e338a3b41c21413db1d2ac7a90a65f5f',
} as const;
