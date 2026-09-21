/**
 * Wallet 模块常量与枚举/状态码映射。
 *
 * 迁移自 td-manage `src/pages/wallet/*`（operational-wallet / user-wallet / wallet-type）。
 * 全部为纯数据/纯函数，便于单测（jest 仅在 util 层可行，见记忆「验证硬限制」）。
 * i18n label key 收敛到模块命名空间 `modules.wallet.*`（各页面按需补 json 键）。
 */

// ── 基础常量 ──────────────────────────────────────────────────────────────────

/** 筛选下拉「全部」占位值（与 chart-of-accounts / journal-entries-new / posting-engine 一致）。 */
export const ALL_VALUE = 'all';

/** 列表默认每页条数。 */
export const DEFAULT_PAGE_SIZE = 10;

/** 空值占位展示。 */
export const EMPTY_DISPLAY = '--';

/** 「无限大」上限阈值：源项目 ≥ 99999999999 视为无限制，展示 ∞、提交归一为 -1。 */
export const UNLIMITED_THRESHOLD = 99999999999;

/** issueType：源项目稳定币发行类型（5=TD 活期/储蓄，20=MMF 货币市场基金）。 */
export const ISSUE_TYPE = {
  TokenizedDeposit: 5,
  MMF: 20,
} as const;

/** accountType：0=N/A，1=活期(Current)，2=储蓄(Savings)，3=MMF 基金账户。 */
export const ACCOUNT_TYPE = {
  None: 0,
  Current: 1,
  Savings: 2,
  Fund: 3,
} as const;

/** custodyModel（源 CUSTODY_MODEL_LABEL_MAP，硬编码英文）。 */
export const CUSTODY_MODEL = {
  IssuerCustody: 1,
  SpCustody: 2,
  SelfCustody: 3,
} as const;

/**
 * Wallet 权限键（语义化占位）。
 *
 * NOTE: 源项目用 localStorage('userPermission') 中的 UUID 做按钮门控。目标映射为语义化
 * 字符串键；权限为空集时页面全放开（等价源项目非 TDManage 环境），见记忆「auth 验证限制」。
 */
export const WALLET_PERMISSIONS = {
  OperationalWalletDetail: 'wallet:operational-wallet:detail',
  UserWalletDetail: 'wallet:user-wallet:detail',
  UserWalletHistory: 'wallet:user-wallet:history',
  UserWalletOperate: 'wallet:user-wallet:operate',
  WalletTypeDetail: 'wallet:wallet-type:detail',
  WalletTypeEdit: 'wallet:wallet-type:edit',
  WalletTypeOperate: 'wallet:wallet-type:operate',
  WalletTypeEarnings: 'wallet:wallet-type:earnings',
} as const;

// ── 状态码族（badge 色调 + label key）──────────────────────────────────────────

/** badge 色调（语义化，由 walletStatusToneClass 映射 Tailwind class）。 */
export type WalletStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'default';

export interface WalletStatusMeta {
  /** 模块命名空间 i18n key（如 'status.enabled'）。 */
  labelKey: string;
  /** badge 色调。 */
  tone: WalletStatusTone;
}

/** 状态码 → 元信息 的查找表类型。 */
type StatusMap = Record<number, WalletStatusMeta>;

/**
 * operational-wallet 状态族（源 approvalTaskStatus）。
 * 1=processing, 8/10=success, 5/15=gray。
 */
const OPERATIONAL_WALLET_STATUS: StatusMap = {
  1: { labelKey: 'status.processing', tone: 'warning' },
  5: { labelKey: 'status.unknown', tone: 'default' },
  8: { labelKey: 'status.success', tone: 'success' },
  10: { labelKey: 'status.active', tone: 'success' },
  15: { labelKey: 'status.inactive', tone: 'default' },
};

/**
 * user-wallet 状态族（源 commonapprovalTaskStatus）。
 * 0=processing, 1=success, 2/3=gray。
 */
const USER_WALLET_STATUS: StatusMap = {
  0: { labelKey: 'status.processing', tone: 'warning' },
  1: { labelKey: 'status.active', tone: 'success' },
  2: { labelKey: 'status.frozen', tone: 'default' },
  3: { labelKey: 'status.inactive', tone: 'default' },
};

/**
 * wallet-type 卡片状态族（源 walletTypeCardState）。
 * 10=enabled(绿), 15=disabled(红), 其余=processing(紫)。
 */
const WALLET_TYPE_CARD_STATUS: StatusMap = {
  10: { labelKey: 'status.enabled', tone: 'success' },
  15: { labelKey: 'status.disabled', tone: 'danger' },
};

/**
 * wallet-type 详情/表状态族（源 walletTypeStatus）。
 * 1=processing, 5=error, 10/25=success, 15/20=gray。
 */
const WALLET_TYPE_STATUS: StatusMap = {
  1: { labelKey: 'status.processing', tone: 'warning' },
  5: { labelKey: 'status.error', tone: 'danger' },
  10: { labelKey: 'status.enabled', tone: 'success' },
  15: { labelKey: 'status.disabled', tone: 'default' },
  20: { labelKey: 'status.inactive', tone: 'default' },
  25: { labelKey: 'status.success', tone: 'success' },
};

/**
 * mff 日收益/股息状态族（源 dailyStatus）。
 * 1/5/20=orange, 10/30=processing, 15/40=error, 35=success。
 */
const MMF_DAILY_STATUS: StatusMap = {
  1: { labelKey: 'status.pending', tone: 'warning' },
  5: { labelKey: 'status.pending', tone: 'warning' },
  10: { labelKey: 'status.processing', tone: 'info' },
  15: { labelKey: 'status.error', tone: 'danger' },
  20: { labelKey: 'status.pending', tone: 'warning' },
  30: { labelKey: 'status.processing', tone: 'info' },
  35: { labelKey: 'status.success', tone: 'success' },
  40: { labelKey: 'status.error', tone: 'danger' },
};

type StatusFamily = 'operational-wallet' | 'user-wallet' | 'wallet-type-card' | 'wallet-type' | 'mmf-daily';

const STATUS_FAMILIES: Record<StatusFamily, StatusMap> = {
  'operational-wallet': OPERATIONAL_WALLET_STATUS,
  'user-wallet': USER_WALLET_STATUS,
  'wallet-type-card': WALLET_TYPE_CARD_STATUS,
  'wallet-type': WALLET_TYPE_STATUS,
  'mmf-daily': MMF_DAILY_STATUS,
};

const DEFAULT_STATUS_META: WalletStatusMeta = {
  labelKey: 'status.unknown',
  tone: 'default',
};

/**
 * 按状态族解析状态码 → 展示元信息。
 *
 * 卡片族默认（未命中）→ processing 紫；其余族默认 → unknown 灰。
 * 迁移自源各页 getStatusMeta / approvalTaskStatus 查找逻辑。
 */
export function resolveWalletStatusMeta(
  family: StatusFamily,
  status?: number | null
): WalletStatusMeta {
  if (status === undefined || status === null) return DEFAULT_STATUS_META;
  const map = STATUS_FAMILIES[family];
  if (map[status]) return map[status];
  if (family === 'wallet-type-card') {
    return { labelKey: 'status.processing', tone: 'info' };
  }
  return DEFAULT_STATUS_META;
}

/** 色调 → Tailwind class（border + bg + text，呼应源项目 Tag 配色）。 */
export function walletStatusToneClass(tone: WalletStatusTone): string {
  switch (tone) {
    case 'success':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'warning':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'danger':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'info':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

// ── 枚举 → i18n label key 解析器 ──────────────────────────────────────────────

/** custodyModel → i18n key（'custodyModel.issuer' 等）。源为硬编码英文，此处改为可国际化。 */
export function custodyModelMessageKey(custodyModel?: number | null): string | undefined {
  switch (custodyModel) {
    case CUSTODY_MODEL.IssuerCustody:
      return 'custodyModel.issuerCustody';
    case CUSTODY_MODEL.SpCustody:
      return 'custodyModel.spCustody';
    case CUSTODY_MODEL.SelfCustody:
      return 'custodyModel.selfCustody';
    default:
      return undefined;
  }
}

/** accountType → i18n key（'accountType.1' 等；0 → undefined 用 EMPTY_DISPLAY 兜底）。 */
export function accountTypeMessageKey(accountType?: number | null): string | undefined {
  if (accountType === undefined || accountType === null || accountType === 0) return undefined;
  return `accountType.${accountType}`;
}

/**
 * wallet 已知 feeType 值域（与 wallet.json 的 `feeType` 对象 keys 同步）。
 * 后端可能返回未定义的枚举值（如 35/40），未在白名单的值降级为 EMPTY_DISPLAY，
 * 避免 next-intl 报 MISSING_MESSAGE。新增 feeType 文案时同步扩充此处与 wallet.json。
 */
const KNOWN_FEE_TYPES: Record<number, true> = { 1: true, 2: true, 10: true, 11: true, 20: true, 25: true, 30: true, 50: true, 60: true };

/** feeType → i18n key（'feeType.10' 等）；未知值返回 undefined 以降级显示。 */
export function feeTypeMessageKey(feeType?: number | null): string | undefined {
  if (feeType === undefined || feeType === null) return undefined;
  if (!(feeType in KNOWN_FEE_TYPES)) return undefined;
  return `feeType.${feeType}`;
}

/** operateType / operationType → i18n key（'operateType.N'）。 */
export function operateTypeMessageKey(operateType?: number | null): string | undefined {
  if (operateType === undefined || operateType === null) return undefined;
  return `operateType.${operateType}`;
}

/** kycRequired / kycType → 'kyc.yes' | 'kyc.no'（源 1=Yes/0=No）。 */
export function kycMessageKey(kyc?: number | null): string | undefined {
  if (kyc === undefined || kyc === null) return undefined;
  return kyc === 1 ? 'kyc.yes' : 'kyc.no';
}
