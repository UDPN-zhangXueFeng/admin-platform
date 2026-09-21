/**
 * tokenized-deposit 模块常量、枚举与权限码。
 *
 * 迁移自 td-manage tokenized-deposit 模块。
 * 状态/类型文案全部走 i18n key 动态拼接（非静态对象字面量）。
 * 权限码控制按钮可见性，共 17 个 hash + 2 个合约内联按钮权限码。
 */

// ── 通用 ──
export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';

/**
 * 对账启用/禁用值（enableTokenReconciliation / enableReserveAssetReconciliation）。
 *
 * 迁移自 td-manage `edit/constants.ts` RECON_DISABLED/RECON_ENABLED。
 * Checkbox valuePropName="checked" + normalize 0/1 → checked/unchecked。
 */
export const RECON_DISABLED = 0;
export const RECON_ENABLED = 1;

// ── 1) 状态机枚举 ──

/** 铸币方法（mintMethod） */
export const MINT_METHOD = {
  /** 稳定币 */
  STABLECOIN: 1,
  /** 代币化存款 */
  TOKENIZED_DEPOSIT: 5,
  /** MMF Token */
  MMF: 20,
} as const;

/** 质押类型（pledgeType） */
export const PLEDGE_TYPE = {
  /** SP 直铸 */
  SP: 0,
  /** 质押铸造 */
  PLEDGE: 1,
} as const;

/** 审批状态（applyStatus） */
export const APPLY_STATUS = {
  /** 待审批 */
  PENDING_REVIEW: 1,
  /** 审批中 */
  REVIEWING: 5,
  /** 审批中（阶段 15） */
  REVIEWING_15: 15,
  /** 待部署 */
  PENDING_DEPLOY: 20,
  /** 已生效 */
  EFFECTIVE: 35,
} as const;

/** TD 启停状态（state） */
export const TD_STATE = {
  /** 未生效 */
  INACTIVE: 0,
  /** 启用 */
  ENABLED: 1,
  /** 禁用 */
  DISABLED: 2,
} as const;

// ── 2) 权限码（17 个核心 + 2 个合约内联按钮）──

export const TD_PERMISSIONS = {
  /** 铸销记录查看 */
  VIEW_RECORD: '0574278982bc44e799c45191d82bd2d7',
  /** Melt 按钮 */
  MELT: '09f612c2ce4b49e99371d86744579822',
  /**
   * Examine（死代码 action，权限码保留勿删。
   * 历史经验：token-pair 中存在死代码权限码被复用的先例。）
   */
  EXAMINE: '2b651d39ec9b4c819b60c6000b118754',
  /** 操作记录查看 */
  VIEW_OPERATION_RECORD: '61dea32a80a14c69a510997acc88c48d',
  /** Delete 按钮 */
  DELETE: '76b7b9b7052247149925a5b587f8b557',
  /** 钱包历史 */
  HISTORY: '8d1bfde1bc76454daaffb370bda04fae',
  /** 查看 Mint/Melt 标题按钮 */
  VIEW_MINT_MELT_TITLE: '91258be4d91611ed93560242ac120002',
  /** Contracts 按钮 */
  CONTRACTS: '98742389681641dda0fd40206fcc5dfd',
  /** Disable 按钮 */
  DISABLE: 'b12984b910d2455fafccbfd02d16d693',
  /** Mint 按钮 */
  MINT: 'bef40ba1d91611ed93560242ac120002',
  /** Enable 按钮 */
  ENABLE: 'c41bb38a01664119937a712e65e81c11',
  /** Edit 按钮 */
  EDIT: 'cbb239787ec6457493d7cb530951baeb',
  /** 钱包查看 */
  VIEW_WALLET: 'd39da78531944d5ba4b8736db471e4b2',
  /** Transactions 按钮 */
  TRANSACTIONS: 'd8beb010d6e34b1a8cd7621cf2425aaf',
  /** 钱包编辑 */
  EDIT_WALLET: 'da8cd0e9325d4e91a6465d6aaff8be18',
  /** Wallets 按钮 */
  WALLETS: 'dc7fe650ac34468cbae16b58de2447ab',
  /** DeploymentHistory 按钮 */
  DEPLOYMENT_HISTORY: 'fc9aa241ea434a42af0b2c1d3cdc3e2c',
  /** 合约表内联按钮 — 升级/部署（type=1） */
  UPGRADE_DEPLOY: 'b010a49839e0479eb514ba1e2305cf2a',
  /** 合约表内联按钮 — 部署（type≠1） */
  DEPLOY: '14f35a319d9d49f5ab2b5f7678cc35dd',
  // ── TD Onboard 入口权限（CustomTab / Empty 页「Onboard」按钮）──
  /** Onboard 入口（TD 新建，跳 /tokenized-deposit/onboard）。 */
  ONBOARD_TD: 'ca6fc2c000f84bf1965a8f03cfbf2286',
  /** Onboard 入口（t_edit 新建，备用分支，源码跳 /tokenized-deposit/t_edit）。 */
  ONBOARD_T_EDIT: '8c0561507ff643e8a7015b62b46eb125',
} as const;

// ── 3) 状态文案/配色 i18n key 前缀（全部走 i18n 动态拼接，无硬编码 JS map）──

/** 任务/记录/钱包/操作状态 颜色 key 前缀 */
export const TASK_STATUS_COLOR_KEY_PREFIX = 'approval_task_status_color_';

/** 任务/记录/钱包/操作状态 文案 key 前缀 */
export const TASK_STATUS_LABEL_KEY_PREFIX = 'common_task_status_';

/** 智能合约状态 颜色 key 前缀 */
export const SMART_CONTRACT_STATUS_COLOR_KEY_PREFIX = 'smart_contract_status_color_';

/** 智能合约状态 文案 key 前缀 */
export const SMART_CONTRACT_STATUS_LABEL_KEY_PREFIX = 'smart_contract_status_';

/** 铸销类型 文案 key 前缀 */
export const RECORD_TYPE_KEY_PREFIX = 'stablecoin_record_type_';

/** 操作记录类型 文案 key 前缀 */
export const OPERATION_RECORD_TYPE_KEY_PREFIX = 'record_type_';

/** SP 交易类型 文案 key 前缀 */
export const ORDER_TYPE_KEY_PREFIX = 'order_type_';

/** Token 类型 文案 key 前缀 */
export const TOKEN_TYPE_KEY_PREFIX = 'token_type_';

/** 钱包类型 文案 key 前缀 */
export const ADMIN_WALLET_TYPE_KEY_PREFIX = 'admin_wallet_type_';

/** 步骤状态 文案 key 前缀 */
export const STEP_STATUS_KEY_PREFIX = 'step_status_';

/** 角色钱包状态 文案 key 前缀 */
export const ROLE_WALLET_STATUS_KEY_PREFIX = 'role_wallet_status_';

/** review_submit_state 文案 key 前缀（view 页用） */
export const REVIEW_SUBMIT_STATE_KEY_PREFIX = 'review_submit_state_';

// ── 4) 前端硬色（非 i18n，纯 UI 配色）──

/** 步骤状态图标色（部署 Modal Steps） */
export const STEP_STATUS_COLOR: Record<number, string> = {
  3: '#d4865f',
  4: '#F4AA00',
};
/** 步骤状态默认色 */
export const STEP_STATUS_DEFAULT_COLOR = '#87ca87';

/** TD state 图标色（概览卡） */
export const TD_STATE_ICON_COLOR: Record<number, string> = {
  0: '#d4865f',
  1: '#87ca87',
  2: '#fe5945',
};

// ── 5) fundType / riskLevel 映射（summary 组件用）──

/** fundType 英文文案映射（1-7） */
export const FUND_TYPE_MAP: Record<number, string> = {
  1: 'Retail Advantage',
  2: 'Institutional Prime',
  3: 'Wholesale Select',
  4: 'Treasury Reserve',
  5: 'Government Liquidity',
  6: 'Sovereign Wealth',
  7: 'Stablecoin Liquidity',
} as const;

/** riskLevel 英文文案映射（1-4） */
export const RISK_LEVEL_MAP: Record<number, string> = {
  1: 'Low R1',
  2: 'Moderately Low R2',
  3: 'Moderate R3',
  4: 'High R4',
} as const;

// ── 6) COA 状态色（Financial Book 初始化卡片）──

/** COA 状态徽标配色 */
export const COA_STATUS_STYLE = {
  configured: {
    bg: '#ECFDF3',
    text: '#16A34A',
  },
  setup_required: {
    bg: '#D9ECFF',
    text: '#1677FF',
  },
} as const;

// ── 7) Financial Book Name 校验 ──

/** Financial Book Name 正则：字母、数字、空格、连字符，1-50 字符 */
export const FINANCIAL_BOOK_NAME_PATTERN = /^[A-Za-z0-9 -]{1,50}$/;
/** Financial Book Name 最大长度 */
export const FINANCIAL_BOOK_NAME_MAX_LENGTH = 50;
/** Financial Book Name 校验规则提示 */
export const FINANCIAL_BOOK_NAME_RULE_MESSAGE =
  'Up to 50 characters (Letters, Numbers, Spaces, hyphen only)';

// ── 8) WalletAttributeType / RoleType ──

/** 钱包属性类型 */
export const WALLET_ATTRIBUTE_TYPE = {
  /** 热钱包 */
  HOT_WALLET: 1,
  /** 冷钱包 */
  COLD_WALLET: 5,
} as const;

/** 钱包角色 */
export const WALLET_ROLE = {
  /** 合约持有者 */
  CONTRACT_OWNER: 1,
  /** Gas 支付 */
  GAS_PAYMENT: 2,
  /** 管理 */
  MANAGEMENT: 3,
} as const;
