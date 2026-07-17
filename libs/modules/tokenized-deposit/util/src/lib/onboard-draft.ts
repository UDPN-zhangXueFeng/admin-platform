/**
 * Onboard 新建页草稿工具（sessionStorage 自动保存 / 恢复 / 清除）。
 *
 * 对齐参考实现 token/lib/token-onboard/draft.ts 的核心决策：
 *
 * - **sessionStorage**（非 localStorage）：草稿随标签页会话生命周期，关闭即清。
 * - **12h TTL**：过期草稿 load 时自动清除。
 * - **version 字段**：结构升级时旧草稿自动失效。
 * - **白名单序列化**：钱包地址 / keystore / 密码绝不入草稿（安全要求，
 *   恢复时钱包字段保持为空并提示用户重新配置）。
 * - 全部 try/catch 包裹：storage 禁用或已满时不阻塞用户填写。
 *
 * ## 类型定位
 *
 * 本文件位于 `type:util` 层，不 import `type:data-access`（Nx enforce-module-boundaries
 * 禁止）。OnboardDraftFormValues / OnboardDraftCoaInfo 为结构类型，与 data-access
 * model.ts 的 TDEditFormValues（白名单子集）/ CoaSetupInfo 保持形状一致，
 * 调用方（feature）传入时 TypeScript 结构类型系统自动兼容。
 */

const DRAFT_KEY = 'td-manage:tokenized-deposit:add-draft:v1';
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时

/**
 * 可入草稿的表单字段（TDEditFormValues 白名单子集）。
 *
 * 显式排除 `walletAddress*` / `keyStore*` / `passWord*` —— 钱包凭据绝不缓存。
 */
export interface OnboardDraftFormValues {
  mintMethod?: number;
  name?: string;
  symbol?: string;
  decimals?: number;
  currencySymbol?: string;
  usPrice?: string;
  reserveAccountId?: number;
  blockchainId?: string;
  smartContractPackageId?: string;
  metaType?: number;
  whitelistMode?: string;
  thresholdType?: string;
  thresholdFrequency?: string;
  thresholdValue?: string;
  accountTypeList?: number[];
  enableTokenReconciliation?: number;
  enableReserveAssetReconciliation?: number;
  keyServiceName?: string;
}

/** 结构类型：与 data-access CoaSetupInfo 同形（status 放宽为 string）。 */
export interface OnboardDraftCoaInfo {
  reserveAccountId?: number | string;
  status?: string;
  financialBookName?: string;
  accountTemplateCode?: string;
  accountTemplateName?: string;
  eodCutOffTime?: string;
  timeZone?: string;
  timeZoneLabel?: string;
  linkedMessage?: string;
  headerNote?: string;
}

/** 双套 COA 草稿（互斥，至多一套有值；stablecoin 套 readonly 时恢复无害）。 */
export interface OnboardDraftCoaValues {
  tokenizedDeposit?: OnboardDraftCoaInfo | null;
  stablecoin?: OnboardDraftCoaInfo | null;
}

export interface OnboardDraft {
  version: 1;
  savedAt: number;
  formValues: OnboardDraftFormValues;
  coa: OnboardDraftCoaValues;
}

const WHITELIST: (keyof OnboardDraftFormValues)[] = [
  'mintMethod',
  'name',
  'symbol',
  'decimals',
  'currencySymbol',
  'usPrice',
  'reserveAccountId',
  'blockchainId',
  'smartContractPackageId',
  'metaType',
  'whitelistMode',
  'thresholdType',
  'thresholdFrequency',
  'thresholdValue',
  'accountTypeList',
  'enableTokenReconciliation',
  'enableReserveAssetReconciliation',
  'keyServiceName',
];

/**
 * 保存草稿（白名单字段 + 双套 COA）。调用方负责 debounce。
 *
 * @param values 完整表单值（内部按白名单挑字段，钱包字段不会序列化）
 * @param coa 双套 COA 数据
 */
export function saveDraft(
  values: OnboardDraftFormValues,
  coa: OnboardDraftCoaValues,
): void {
  if (typeof window === 'undefined') return;
  try {
    const formValues: Record<string, unknown> = {};
    for (const key of WHITELIST) formValues[key] = values[key];
    const draft: OnboardDraft = {
      version: 1,
      savedAt: Date.now(),
      formValues: formValues as OnboardDraftFormValues,
      coa,
    };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage 禁用或已满时不阻塞用户填写
  }
}

/** 读取草稿。版本不符 / 过期 / 解析失败时自动清除并返回 null。 */
export function loadDraft(): OnboardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OnboardDraft;
    if (draft.version !== 1 || typeof draft.savedAt !== 'number') {
      clearDraft();
      return null;
    }
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    clearDraft();
    return null;
  }
}

/** 清除草稿（提交成功 / 用户丢弃 / Reset 时调用）。 */
export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** 草稿时间展示格式：`YYYY-MM-DD HH:mm`（本地时区）。 */
export function formatDraftTime(savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
