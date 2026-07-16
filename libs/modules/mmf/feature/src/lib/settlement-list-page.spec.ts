/**
 * Settlement list page — i18n 键完整性 + 列定义表头契约单测。
 *
 * 覆盖验收（针对 verify 发现的 i18n 落空缺陷）：
 *   - 两列金额表头不再复用同一个 field.accrualUnits：
 *     accruedTokenCount → field.dividendAmount（源 wallet_type_165 "Dividend Amount"）
 *     realityTokenCount → field.distributedDividend（源 mmf_0018 "Distributed Dividend"）
 *   - transactionType 渲染键 status.mmf_settlement_tx_type_${txType} 在 zh+en 均存在，
 *     否则列表行该列会原样回显 key（运行时断裂）。
 *
 * 设计意图（Rule 9）：这些断言会在「有人再次删掉/拼错 i18n key」时失败，
 * 即真正守护「列表金额列与交易类型列不再显示原始 key」这一业务诉求。
 *
 * 纯 JSON 契约断言，无需 React / jest-dom（与 mmf.constants.spec 同款）。
 */
import * as path from 'path';
import * as fs from 'fs';

// 运行时读取真实 i18n 源文件（与 merge-messages.ts 静态 import 同源），
// 用 fs 而非 import 以避开 @nx/enforce-module-boundaries 对跨 lib 相对路径的限制。
const messagesRoot = path.resolve(
  __dirname,
  '../../../../../shared/util-i18n-messages/src/lib',
);
const zhCN = JSON.parse(
  fs.readFileSync(path.join(messagesRoot, 'zh-CN/modules/mmf.json'), 'utf-8'),
);
const enUS = JSON.parse(
  fs.readFileSync(path.join(messagesRoot, 'en-US/modules/mmf.json'), 'utf-8'),
);

/** settlement-list-page 渲染时实际读取的 i18n key 清单（路径相对 modules.mmf 命名空间）。 */
const REQUIRED_KEYS = [
  // 两列金额表头（缺陷1：必须互不相同）
  'field.dividendAmount',
  'field.distributedDividend',
  // 交易类型渲染前缀（缺陷2/3：status.* 结构下补键）
  'status.mmf_settlement_tx_type_70',
] as const;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** 断言嵌套路径存在且为非空字符串；失败时抛出带 locale + key 的清晰错误（Jest 30 expect 无 message 参数）。 */
function expectStringAt(
  messages: Record<string, unknown>,
  path: string,
  label: string,
): void {
  const value = getPath(messages, path);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}: missing or non-string i18n key "${path}"`);
  }
}

describe('settlement-list-page i18n keys (zh-CN + en-US)', () => {
  it.each([
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ] as const)('exposes every required key for %s', (locale, messages) => {
    for (const key of REQUIRED_KEYS) {
      expectStringAt(messages, key, locale);
    }
  });

  it('uses distinct headers for the two dividend-amount columns (defect: was both accrualUnits)', () => {
    // 源 settlement/index.tsx：accruedTokenCount→Dividend Amount、
    // realityTokenCount→Distributed Dividend，二者语义不同，表头不可复用。
    expect(zhCN.field.dividendAmount).not.toBe(zhCN.field.distributedDividend);
    expect(enUS.field.dividendAmount).not.toBe(enUS.field.distributedDividend);
  });

  it('keeps the accrualUnits key intact for the detail page wallet-record column', () => {
    // 回归守护：dividendAmount/distributedDividend 是新增键，
    // 不应挤占 detail 页 Tab1 钱包记录列仍在使用的 accrualUnits。
    expect(zhCN.field.accrualUnits).toBeTruthy();
    expect(enUS.field.accrualUnits).toBeTruthy();
  });
});

describe('settlement-list-page transactionType rendering contract', () => {
  // constants 中前缀与页面渲染拼接逻辑：t(`${SETTLEMENT_TX_TYPE_KEY_PREFIX}_${txType}`)
  // SETTLEMENT_TX_TYPE_KEY_PREFIX = 'status.mmf_settlement_tx_type'
  it('resolves the only known source txType (70) via the status.* prefix', () => {
    // 源 td-manage en-US/mmf.json 仅定义 mmf_settlement_tx_type_70 = "Fund Dividend Distribution"。
    expect(zhCN.status.mmf_settlement_tx_type_70).toBe('基金分红分配');
    expect(enUS.status.mmf_settlement_tx_type_70).toBe('Fund Dividend Distribution');
  });
});
