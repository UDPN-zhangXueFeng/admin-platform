/**
 * Liq. Coverage 口径单测（2026-11-03 裁决：分母 = token 级 Min. Liquidity）。
 *
 * 两条用例都取自联调库真实数据：
 *  - BRX 池（0x8180…c53c42a）：余额 9,875.7、授权 4,500 − 已用 2,116.3 = 可用
 *    2,383.7、token min 10,000 → 24%。旧算法用参与对 min 合计（1,000）算出
 *    238%，把「授权额度不足」显示成 Sufficient。
 *  - BXW 池（0x25b5…d07d936）：余额 33,209、可用预授权 0、token min 10,000
 *    → 0%。可用授权为 0 必须照算（授权侧没有可解付额度，真实告急），
 *    不能因为余额充足就掩盖。
 */
import type { LpPoolRow } from '@myorg/modules/kissen-admin/data-access';

import { computePoolCoverage } from './lp-coverage';

/** 只填水位计算关心的字段，其余按类型补默认值（真实行字段见 LpPoolRow）。 */
function row(overrides: Partial<LpPoolRow>): LpPoolRow {
  return {
    poolId: 1,
    lpId: 10,
    lpName: 'LPxx',
    tokenId: 9,
    tokenCode: 'token',
    tokenNo: 'token',
    minLiquidity: 10000,
    accountAddress: '0x0',
    currencySystemType: 1,
    remindThreshold: 0.5,
    availableBalanceCache: 0,
    balanceUpdateTime: 0,
    authAmount: null,
    preauthAvailable: null,
    preauthValidTo: null,
    preauthSnapshotTime: null,
    status: 20,
    createTime: 0,
    requiredMinSum: null,
    requiredAuthSum: null,
    ...overrides,
  };
}

describe('computePoolCoverage', () => {
  it('授权剩余低于余额时用授权算，分母取 token 最低流动性（BRX 池 24%）', () => {
    const result = computePoolCoverage(
      row({
        availableBalanceCache: '9875.70000000',
        authAmount: '4500.00000000',
        preauthAvailable: '2383.70000000',
        minLiquidity: '10000.00000000',
        requiredMinSum: '1000.00000000',
      }),
    );

    expect(result).toEqual({
      numerator: 2383.7,
      requiredMin: 10000,
      percentage: 24,
    });
  });

  it('可用预授权为 0 时照算 0%，不被余额掩盖（BXW 池 0%）', () => {
    const result = computePoolCoverage(
      row({
        availableBalanceCache: '33209.00000000',
        authAmount: '0.00000000',
        preauthAvailable: '0.00000000',
        minLiquidity: '10000.00000000',
        requiredMinSum: '10000.00000000',
      }),
    );

    expect(result).toEqual({
      numerator: 0,
      requiredMin: 10000,
      percentage: 0,
    });
  });

  it('预授权快照整体缺失（null）时才回落余额', () => {
    const result = computePoolCoverage(
      row({
        availableBalanceCache: '20000',
        authAmount: null,
        preauthAvailable: null,
        minLiquidity: '10000',
      }),
    );

    expect(result?.percentage).toBe(200);
  });

  it('token 最低流动性为 0 或缺失时不计算（画 -）', () => {
    expect(
      computePoolCoverage(
        row({ availableBalanceCache: '100', minLiquidity: '0' }),
      ),
    ).toBeNull();
    expect(
      computePoolCoverage(
        row({
          availableBalanceCache: '100',
          minLiquidity: null as unknown as number,
        }),
      ),
    ).toBeNull();
  });
});
