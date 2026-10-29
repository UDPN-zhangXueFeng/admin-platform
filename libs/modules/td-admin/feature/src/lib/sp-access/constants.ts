/**
 * SP Access Management 常量。
 *
 * 值集合/回退色与上游 td-manage sp-access 一致；用户可见文案一律走
 * modules.sp-access 双语词典（formatters / 页面内 t() 动态键），不在常量里
 * 存英文 label（上游硬编码英文不复制，见 alignment.md DISP-4）。
 */

// ---------- 按钮权限（后端 UUID，原样取自上游 actions[].limit，不得语义化） ----------

export const SP_ACCESS_PERMISSIONS = {
  /** 行内 Edit（state∈{1,2} 可用，未授权隐藏） */
  edit: '8c31495dc5894f8e935edde7d436225b',
  /** 行内 View */
  view: '761e2d985b8a4f95a0df8dc3009fa0f1',
  /** 页头 Register 按钮（上游双权限命中渲染两枚，下游合并为一枚，见 alignment.md L-04） */
  register: 'a7e2f58d6d974cdca313df79c7b8b732',
  registerAlt: 'e425450b09de42cc9f8c126c2be178c9',
} as const;

// ---------- 列表 / 详情状态 ----------

/** spInfoState 已补全词条值集合 {0,1,2}（集合外回退占位） */
export const SP_STATUS_VALUES = new Set([0, 1, 2]);

/** sp_status_color_N 缺失时的回退色（上游 fallbackMap） */
export const SP_STATUS_FALLBACK_COLOR: Record<number, string> = {
  0: 'processing',
  1: 'success',
  2: 'gray',
};

// ---------- 审批任务状态（操作记录 / 提交的交易共用词表） ----------

export const COMMON_TASK_STATUS_VALUES = new Set([
  1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45,
]);

/** Submitted Transactions 状态筛选项（上游固定 [5,10,15,20,30,35,40,45]） */
export const SUBMITTED_TX_STATUS_FILTER_VALUES = [5, 10, 15, 20, 30, 35, 40, 45] as const;

/**
 * Submitted Transactions 状态色：上游本页 colorMap
 * （1,3,45→default；5,10,20,30→processing；15,40→error；35→success），
 * 集合外回退 approval_task_status_color_N 词条。
 */
export const SUBMITTED_TX_STATUS_COLOR: Record<number, string> = {
  1: 'gray',
  3: 'gray',
  45: 'gray',
  5: 'processing',
  10: 'processing',
  20: 'processing',
  30: 'processing',
  15: 'error',
  40: 'error',
  35: 'success',
};

// ---------- 用户钱包 ----------

/** user_wallet_state 已补全词条值集合 {0,1,2,3} */
export const USER_WALLET_STATE_VALUES = new Set([0, 1, 2, 3]);

/** User Wallets 状态筛选项：'0'..'3'（上游 Select 无 '全部' 占位，默认 ''） */
export const USER_WALLET_STATUS_FILTER_VALUES = ['0', '1', '2', '3'] as const;

/** custody model（privateKeyCustodyModel）值集合 */
export const CUSTODY_MODEL_VALUES = ['1', '2', '3'] as const;

// ---------- 提交的交易 ----------

export const TX_TYPE_VALUES = ['1', '2', '3', '4', '5'] as const;

export const TX_DATA_SOURCE_VALUES = ['1', '2'] as const;

// ---------- 代币类型 ----------

/** token_type_N 已补全词条值集合 {1,3,4,5,20}；图标 token_type_N.svg 同键 */
export const TOKEN_TYPE_VALUES = new Set([1, 3, 4, 5, 20]);

// ---------- 服务商类型 ----------

export const SERVICE_PROVIDER_TYPE_VALUES = ['1', '5', '10', '15', '20', '25'] as const;

// ---------- 表单 ----------

export const RECONCILIATION_FREQUENCY_VALUES = ['1', '2', '3'] as const;

/** 默认私钥托管模型（上游 INITIAL_FORM_VALUES.privateKeyCustodyModel） */
export const DEFAULT_PRIVATE_KEY_CUSTODY_MODEL = ['sp', 'end_user'] as const;

/** parse 兜底（上游 getPrivateKeyCustodyModel fallback） */
export const FALLBACK_PRIVATE_KEY_CUSTODY_MODEL = ['sp', 'end_user'] as const;

/** 交易提交策略固定 '1,2'（上游双只读 Switch，恒发送） */
export const TRANSACTION_POLICY_FIXED = '1,2';

/** metaType：关闭=1 / 开启=5 */
export const META_TYPE_DISABLED = 1;
export const META_TYPE_ENABLED = 5;

/** KYC 固定 1（上游 Switch 恒关 disabled，无控件） */
export const KYC_REQUIRED_FIXED = 1;

/** accessType：OpenAPI=1 / Contract=5 */
export const API_ACCESS_TYPE = 1;
export const CONTRACT_ACCESS_TYPE = 5;

/** 业务许可 busType（上游固定 '1'） */
export const BUSINESS_LICENSE_BUS_TYPE = '1';

/** 业务许可大小上限 2MB */
export const BUSINESS_LICENSE_MAX_SIZE_BYTES = 2 * 1024 * 1024;

/** 业务许可 accept 白名单 */
export const BUSINESS_LICENSE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.bmp,.gif';

/** contactName/spName maxLength */
export const NAME_MAX_LENGTH = 50;
/** email maxLength */
export const EMAIL_MAX_LENGTH = 100;
/** phone maxLength */
export const PHONE_MAX_LENGTH = 15;
/** description maxLength */
export const DESCRIPTION_MAX_LENGTH = 200;

/** spType 初始值（上游 initialValue 1） */
export const DEFAULT_SP_TYPE = '1';

/** 编辑态 OpenAPI/Contract 权限名单折叠阈值（前 6 个直显，其余 +N...） */
export const PERMISSION_LIST_PREVIEW_COUNT = 6;

/** API Documentation 静态 PDF（上游 BaseInfo Token Permission 区 window.open 原样） */
export const SP_ACCESS_API_DOC_URL =
  '/Tokenized Deposit OpenAPI Documentation for Service Provider v2.2.0.pdf';
