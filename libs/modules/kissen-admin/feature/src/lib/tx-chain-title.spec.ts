/**
 * 链路节点标题口径（2026-11-03 三系统统一）：阶段事件用业务动作名，文案必须与
 * kissen-gateway `TX_STAGE_EVENT_TITLE` 逐字一致——三端详情页对比时不允许出现
 * 「admin 显示 Quoted、网关显示 Quote Accepted」这种差异。
 *
 * 通用事件（step=0）与历史 7/8 段仍按状态文案，未知状态码降级 `Status N`。
 */
import { txStageEventTitle } from '@myorg/modules/kissen-admin/data-access';

describe('txStageEventTitle', () => {
  it('阶段事件 1~6 用业务动作名（与网关同文案）', () => {
    expect(txStageEventTitle(1, 5)).toBe('Quote Accepted');
    expect(txStageEventTitle(2, 10)).toBe('User Confirmation');
    expect(txStageEventTitle(3, 20)).toBe('Source Transfer Initiated');
    expect(txStageEventTitle(4, 25)).toBe('Source Arrival Verified');
    expect(txStageEventTitle(5, 30)).toBe('Disbursement Initiated');
    expect(txStageEventTitle(6, 35)).toBe('Credited');
  });

  it('通用事件（step=0）回退状态文案', () => {
    expect(txStageEventTitle(0, 35)).toBe('Completed');
    expect(txStageEventTitle(0, 60)).toBe('Reversed');
  });

  it('历史 7/8 段不再有业务名，回退状态文案', () => {
    expect(txStageEventTitle(7, 35)).toBe('Completed');
    expect(txStageEventTitle(8, 35)).toBe('Completed');
  });

  it('未知状态码降级 Status N', () => {
    expect(txStageEventTitle(0, 99)).toBe('Status 99');
  });
});
