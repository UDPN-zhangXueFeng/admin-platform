/**
 * LP 门户资金池 Liq. Coverage 计算。
 *
 * 口径与 admin 资金池页一致（2026-11-03 裁决，PRD v2.0 §2.4.3）：
 *  - 分子 = min(钱包余额, 可用预授权)。预授权快照存在但可用额度为 0 时照算，
 *    结果就是 0%（授权侧确实没有可解付额度）；快照缺失才回落余额。
 *  - 分母 = 该池 token 的 Min. Liquidity（`/lp/token/list` 的 `minLiquidity`），
 *    不是后端 `level` 用的「Σ 引用该地址的参与对门槛」。
 *  - 分母 ≤ 0 或分子非数 → null（页面画 '-'）。
 *
 * 说明：本仓 BFF 的 `PoolRow.level` 仍是旧口径（Σ 门槛），页面改为前端按本函数
 * 重算；后端口径对齐后可删掉这层并回到消费 `level`。
 */
import * as React from 'react';

import {
  LP_PROJECT_ID,
  useTokenListQuery,
  type PoolRow,
} from '@myorg/modules/lp-portal/data-access';

export interface LpPoolCoverage {
  /** 分子：min(钱包余额, 可用预授权)。 */
  numerator: number;
  /** 分母：token 级最低流动性。 */
  requiredMin: number;
  /** 百分比（四舍五入整数，238 表示 238%）。 */
  percentage: number;
}

type Amount = string | number | null | undefined;

function toNumber(value: Amount): number {
  if (value == null || value === '') return Number.NaN;
  return Number(value);
}

export function computeLpPoolCoverage(
  row: Pick<PoolRow, 'availableBalanceCache' | 'preauthAvailableAmount'>,
  minLiquidity: Amount,
): LpPoolCoverage | null {
  const balance = toNumber(row.availableBalanceCache);
  const available = toNumber(row.preauthAvailableAmount);
  // 有快照（含 0）就以 min 计；快照缺失才算余额。
  const numerator =
    Number.isFinite(available) && available < balance ? available : balance;
  const requiredMin = toNumber(minLiquidity);
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

/**
 * tokenId → token 级最低流动性（`/lp/token/list` 的 minLiquidity）。
 * 资金池列表页、详情页、Dashboard「My Liquidity Pools」共用同一个分母来源。
 */
export function useTokenMinLiquidity(): ReadonlyMap<number, number> {
  const tokenQuery = useTokenListQuery(LP_PROJECT_ID);
  return React.useMemo(() => {
    const map = new Map<number, number>();
    for (const token of tokenQuery.data ?? []) {
      const min = Number(token.minLiquidity);
      if (Number.isFinite(min)) map.set(token.tokenId, min);
    }
    return map;
  }, [tokenQuery.data]);
}

/** poolId → 覆盖率（分母缺失的池不出现在 Map 里）。 */
export function usePoolCoverageMap(
  pools: ReadonlyArray<PoolRow>,
): ReadonlyMap<number, LpPoolCoverage> {
  const tokenMin = useTokenMinLiquidity();
  return React.useMemo(() => {
    const map = new Map<number, LpPoolCoverage>();
    for (const pool of pools) {
      const coverage = computeLpPoolCoverage(
        pool,
        tokenMin.get(pool.tokenId) ?? null,
      );
      if (coverage != null) map.set(pool.poolId, coverage);
    }
    return map;
  }, [pools, tokenMin]);
}
