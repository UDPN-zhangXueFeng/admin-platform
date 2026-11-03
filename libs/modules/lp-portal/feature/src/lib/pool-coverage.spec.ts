/**
 * LP 资金池 Liq. Coverage 口径单测（2026-11-03，与 admin 资金池页同口径）：
 * 分子 min(钱包余额, 可用预授权) ÷ token 级 Min. Liquidity。
 *
 * 数据取自联调库真实池：BRX 池（余额 9,875.7 / 可用授权 2,383.7 / token min
 * 10,000 → 24%），BXW 池（余额 33,209 / 可用授权 0 / token min 10,000 → 0%，
 * 可用授权为 0 必须照算，不能用余额掩盖）。旧口径用 BFF 下发的 `level`
 *（Σ 参与对门槛 1,000）会得到 238%，把「授权不足」显示成 Sufficient。
 */
import type { PoolRow } from '@myorg/modules/lp-portal/data-access';

import { computeLpPoolCoverage } from './pool-coverage';

function row(overrides: Partial<PoolRow>): PoolRow {
  return {
    poolId: 1,
    tokenId: 9,
    tokenNo: 'token',
    tokenCode: 'token',
    bankCode: 'bank',
    poolAddress: '0x0',
    status: 20,
    rejectReason: '',
    availableBalanceCache: 0,
    balanceUpdateTime: null,
    level: null,
    syncTime: 0,
    ...overrides,
  };
}

describe('computeLpPoolCoverage', () => {
  it('可用授权低于余额时用授权算，分母取 token 最低流动性（BRX 池 24%）', () => {
    expect(
      computeLpPoolCoverage(
        row({
          availableBalanceCache: '9875.70000000',
          preauthAuthAmount: '4500.00000000',
          preauthAvailableAmount: '2383.70000000',
        }),
        '10000.00000000',
      ),
    ).toEqual({ numerator: 2383.7, requiredMin: 10000, percentage: 24 });
  });

  it('可用预授权为 0 时照算 0%，不被余额掩盖（BXW 池 0%）', () => {
    expect(
      computeLpPoolCoverage(
        row({
          availableBalanceCache: '33209.00000000',
          preauthAuthAmount: '0.00000000',
          preauthAvailableAmount: '0.00000000',
        }),
        '10000.00000000',
      ),
    ).toEqual({ numerator: 0, requiredMin: 10000, percentage: 0 });
  });

  it('预授权快照缺失（null）时才回落余额', () => {
    expect(
      computeLpPoolCoverage(
        row({ availableBalanceCache: '20000', preauthAvailableAmount: null }),
        '10000',
      )?.percentage,
    ).toBe(200);
  });

  it('token 最低流动性缺失或为 0 时不计算（页面画 -）', () => {
    expect(
      computeLpPoolCoverage(row({ availableBalanceCache: '100' }), null),
    ).toBeNull();
    expect(
      computeLpPoolCoverage(row({ availableBalanceCache: '100' }), '0'),
    ).toBeNull();
  });
});
