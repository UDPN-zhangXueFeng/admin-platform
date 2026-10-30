/**
 * Clearance Pipeline rail 推导契约（2026-10-30 tx125 事故回归锚点）。
 *
 * 事故：tx125（status=35 Credited）链路含终态事件 30→35，但 RAIL_CODES 只收
 * 40——chainTimes/chainMax 直接丢弃 35，stageIndex 卡在 Processing（第 6 环），
 * 第 7 环 Completed 对 Credited 终态交易永远 Pending（页面 6/7、86%）。
 * 修复契约：35 归一到 40 与终局事件同环；终态（35/40）在当前环节判 done。
 */
import {
  RAIL_CODES,
  RAIL_CODE_LIST,
  RAIL_STEPS,
  chainEventRailCode,
  railState,
} from './tx-flow-rail';

describe('chainEventRailCode 链路事件码归一', () => {
  it('rail 内码原样返回', () => {
    for (const c of RAIL_CODES) {
      expect(chainEventRailCode(c)).toBe(c);
    }
  });

  it('35（Credited）归一到 40——终态事件 30→35 不再被 chainTimes/chainMax 丢弃', () => {
    expect(chainEventRailCode(35)).toBe(40);
    // 归一结果必须落在 rail 轴上（chainMax indexOf 可命中末环）
    expect(RAIL_CODE_LIST).toContain(chainEventRailCode(35));
  });

  it('分支/异常码不归一——rail 推进只认主线事件，异常位置由行内状态兜底', () => {
    // 90（Failed）若被钳到 Processing 会把源端失败误推到解付环，必须原样（不入 rail）
    expect(chainEventRailCode(90)).toBe(90);
    expect(chainEventRailCode(50)).toBe(50);
  });
});

describe('railState 终态环节判定（tx125：status=35 Credited）', () => {
  const lastIndex = RAIL_STEPS.length - 1; // Completed 环（第 7 环）

  it('chainMax 抵达末环时第 7 环判 done（7/7 Finalized）', () => {
    expect(railState(35, 'Credited', lastIndex, lastIndex)).toBe('done');
  });

  it('chainMax 卡在 Processing 时第 7 环 future——事故现场（显示 Pending）', () => {
    // 归一修复前 chainMax=5，此断言即当时用户看到的 6/7
    expect(railState(35, 'Credited', lastIndex, lastIndex - 1)).toBe('future');
  });

  it('进行中交易当前环 warning', () => {
    expect(railState(30, 'Processing', 5, 5)).toBe('warning');
  });
});
