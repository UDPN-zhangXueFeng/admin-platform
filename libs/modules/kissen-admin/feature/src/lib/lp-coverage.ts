/**
 * Liq. Coverage 计算（LP 资金池水位）。
 *
 * 口径（2026-11-03 裁决，对齐 PRD v2.0 §2.4.3 的 token 级最低流动性）：
 *  - 分子 = min(可用余额, 可用预授权)。预授权快照存在但可用额度为 0 时**照算**，
 *    结果就是 0%（授权侧确实没有可解付额度，属真实告急，不能用手里的余额掩盖）；
 *    只有快照整体缺失（preauthAvailable == null）才回落可用余额。
 *  - 分母 = 该池 token 的 Min. Liquidity（token_info.min_liquidity），
 *    不再是「引用该地址的参与对 min 合计」。
 *  - 分母 ≤ 0 或分子非数 → null（列表画 '-'）。
 */
import type { LpPoolRow } from '@myorg/modules/kissen-admin/data-access';

export interface PoolCoverageResult {
  /** 水位分子：min(可用余额, 可用预授权)。 */
  numerator: number;
  /** 水位分母：token 级最低流动性。 */
  requiredMin: number;
  /** 百分比（四舍五入整数，238 表示 238%）。 */
  percentage: number;
}

export function computePoolCoverage(row: LpPoolRow): PoolCoverageResult | null {
  const balance = Number(row.availableBalanceCache);
  const avail =
    row.preauthAvailable == null ? null : Number(row.preauthAvailable);
  // 有快照（含 0）就以 min 计；快照缺失才算余额。
  const numerator =
    avail != null && Number.isFinite(avail) && avail < balance
      ? avail
      : balance;
  const requiredMin =
    row.minLiquidity == null ? Number.NaN : Number(row.minLiquidity);
  if (!Number.isFinite(numerator) || !Number.isFinite(requiredMin)) {
    return null;
  }
  if (requiredMin <= 0) {
    return null;
  }
  return {
    numerator,
    requiredMin,
    percentage: Math.round((numerator / requiredMin) * 100),
  };
}
