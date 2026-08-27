import { sanitizeBrandText } from './auth.api';

describe('sanitizeBrandText', () => {
  it('falls back to the English default when the backend brand copy contains CJK', () => {
    // 实测 87 环境 brand 接口返回中文文案；约束 1 要求用户可见字符串零 CJK。
    expect(sanitizeBrandText('Kissen 银行门户', 'Kissen Bank Portal')).toBe(
      'Kissen Bank Portal',
    );
  });

  it('passes non-CJK white-label copy through unchanged', () => {
    expect(sanitizeBrandText('Kissen Clearing', 'Kissen Bank Portal')).toBe(
      'Kissen Clearing',
    );
  });

  it('falls back on empty or whitespace-only values', () => {
    expect(sanitizeBrandText(undefined, 'Bank Portal Console')).toBe(
      'Bank Portal Console',
    );
    expect(sanitizeBrandText('   ', 'Bank Portal Console')).toBe(
      'Bank Portal Console',
    );
  });
});
