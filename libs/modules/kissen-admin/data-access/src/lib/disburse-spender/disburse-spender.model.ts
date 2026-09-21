/**
 * 解付 Spender 域模型（源 `api/disburse-spender.ts`，commit 5ace899）。
 *
 * token 级 Kissen 交易钱包签名身份（2026-08-31 解付签名模型改造）：LP 须在
 * 货币系统把池钱包按 tokenCode 授权给 spender 地址，Kissen 才能执行解付划转。
 * 私钥 write-only：仅 save 时提交一次，AES 密文落库，任何接口不回显。
 */

export interface DisburseSpenderRow {
  spenderId: number;
  tokenId: number;
  tokenCode: string;
  symbol: string;
  bankName: string;
  /** Kissen 交易钱包地址（LP 在货币系统的授权对象）。 */
  spenderAddress: string;
  /** 20 启用 / 50 停用（停用=该 token 解付冻结）。 */
  status: number;
  remarks: string;
  updateTime: number;
}

/**
 * 录入/轮换请求（tokenId 已存在即覆盖旧钥——再次保存立即替换）；
 * 私钥仅本次提交，密文落库。
 */
export interface SpenderSaveReq {
  tokenId: number;
  spenderAddress: string;
  privateKey: string;
  remarks?: string;
}

/** 启用/停用请求（disabled=true 即该 token 解付冻结）。 */
export interface SpenderStatusReq {
  tokenId: number;
  disabled: boolean;
}

/** Spender 状态英文定稿（对齐 TOKEN_STATUS_LABEL 的 20/50 口径）。 */
export const SPENDER_STATUS_LABEL: Record<number, string> = {
  20: 'Enabled',
  50: 'Disabled',
};

/** 状态 → Badge variant（源 el-tag success/danger → default/destructive）。 */
export const SPENDER_STATUS_VARIANT: Record<number, 'default' | 'destructive'> = {
  20: 'default',
  50: 'destructive',
};
