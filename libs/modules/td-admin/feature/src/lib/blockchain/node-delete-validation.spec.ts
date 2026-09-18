/**
 * 节点删除 Modal URL 严格校验单测 —— validateDeleteUrl。
 *
 * 验收（blockchain.md 第9章「node 删除 Modal」/ 第8章「URL 严格相等校验」）：
 *   - 用户输入必须严格 === modalInfo.url（含协议/路径完整）才通过。
 *   - 空 → deleteInputRequired（必填）。
 *   - 非空但不等 → deleteInputMismatch（{url} 插值，动态文案）。
 *   - 差一字符 / 前后空格 / 协议不同 → 均判失败（严格相等，非 trim）。
 *
 * 纯函数 spec（无 React），对齐 mmf batch-apply-selection.spec 风格。
 */
import { validateDeleteUrl } from './node-delete-validation';

const TARGET = 'https://etherscan.io/node/1';

const messages = {
  required: 'Please enter the URL',
  mismatch: (url: string) => `Must match ${url}`,
};

describe('validateDeleteUrl', () => {
  it('passes (returns true) when the input strictly equals the target URL', () => {
    expect(validateDeleteUrl(TARGET, TARGET, messages)).toBe(true);
  });

  it('rejects an empty input with the required message', () => {
    expect(validateDeleteUrl('', TARGET, messages)).toBe(messages.required);
  });

  it('rejects an input that differs by a single character', () => {
    // 严格相等：少一个字符即失败。
    expect(validateDeleteUrl(`${TARGET}x`, TARGET, messages)).toBe(
      messages.mismatch(TARGET),
    );
  });

  it('does NOT trim whitespace — leading/trailing space fails (strict equality)', () => {
    expect(validateDeleteUrl(` ${TARGET}`, TARGET, messages)).toBe(
      messages.mismatch(TARGET),
    );
    expect(validateDeleteUrl(`${TARGET} `, TARGET, messages)).toBe(
      messages.mismatch(TARGET),
    );
  });

  it('rejects a different protocol (http vs https)', () => {
    const httpVariant = TARGET.replace('https://', 'http://');
    expect(validateDeleteUrl(httpVariant, TARGET, messages)).toBe(
      messages.mismatch(TARGET),
    );
  });

  it('rejects a trailing slash difference', () => {
    expect(validateDeleteUrl(`${TARGET}/`, TARGET, messages)).toBe(
      messages.mismatch(TARGET),
    );
  });

  it('rejects case differences (URLs are case-sensitive)', () => {
    expect(
      validateDeleteUrl(TARGET.toUpperCase(), TARGET, messages),
    ).toBe(messages.mismatch(TARGET));
  });

  it('rejects an empty input even when the target is also empty (required guard precedes equality)', () => {
    // 空 input 一律走 required 分支（空值守卫优先于严格相等），
    // 即使目标 url 也是空串也必须报「请输入」——这是 react-hook-form 必填语义。
    expect(validateDeleteUrl('', '', messages)).toBe(messages.required);
  });

  it('builds the mismatch message with the target url for interpolation', () => {
    const result = validateDeleteUrl('wrong', TARGET, messages);
    expect(result).toBe(`Must match ${TARGET}`);
  });
});
