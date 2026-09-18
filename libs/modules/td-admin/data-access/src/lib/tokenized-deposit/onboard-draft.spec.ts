import { saveDraft, loadDraft, clearDraft, draftKey } from './onboard-draft';

/**
 * onboard-draft 草稿纯函数测试。
 *
 * 业务意图（而非仅行为）：
 * - 钱包凭据（walletAddress* / keyStore* / passWord*）绝不入草稿 —— 安全红线。
 * - 草稿 12h 过期 / version 升级 / 数据损坏时自动失效并清除，避免恢复脏数据。
 * - scoped key 按用户隔离，A 用户的草稿绝不泄漏给 B 用户。
 * - storage 异常（禁用 / 已满）不阻塞用户填写，saveDraft 以返回值上报成败而非 throw。
 */
describe('onboard-draft', () => {
  const scopeA = { userId: 'a' };
  const scopeB = { userId: 'b' };

  beforeEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  /** 读取并解析指定 scope 的草稿原始内容。 */
  function readRaw(scope: { userId: string }) {
    const raw = window.sessionStorage.getItem(draftKey(scope));
    return raw ? JSON.parse(raw) : null;
  }

  // ===== 1. 白名单过滤：钱包凭据绝不入草稿 =====

  it('should NOT persist walletAddress*/keyStore*/passWord* into sessionStorage (security)', () => {
    saveDraft(
      scopeA,
      {
        name: 'My Token',
        symbol: 'MTK',
        // 以下为钱包凭据，必须被白名单过滤掉
        walletAddress: '0xABC',
        keyStore: '{"crypto":{}}',
        passWord: 'secret',
      } as never,
      { tokenizedDeposit: null, stablecoin: null },
    );

    const raw = window.sessionStorage.getItem(draftKey(scopeA));
    expect(raw).not.toBeNull();
    // 原始字符串层面断言：任何凭据字段名/值都不应出现
    expect(raw).not.toContain('walletAddress');
    expect(raw).not.toContain('keyStore');
    expect(raw).not.toContain('passWord');
    expect(raw).not.toContain('0xABC');
    expect(raw).not.toContain('secret');

    // 白名单字段正常入草稿
    const parsed = readRaw(scopeA);
    expect(parsed.formValues.name).toBe('My Token');
    expect(parsed.formValues.symbol).toBe('MTK');
  });

  // ===== 2. TTL：过期草稿返回 null 并清除 =====

  it('should return null and clear draft when savedAt is older than 12h TTL', () => {
    saveDraft(scopeA, { name: 'Stale' } as never, {
      tokenizedDeposit: null,
      stablecoin: null,
    });
    const key = draftKey(scopeA);
    const draft = readRaw(scopeA);
    // 手改 savedAt 为 13 小时前
    draft.savedAt = Date.now() - 13 * 60 * 60 * 1000;
    window.sessionStorage.setItem(key, JSON.stringify(draft));

    expect(loadDraft(scopeA)).toBeNull();
    // 过期草稿应被清除，避免下次重复解析
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  // ===== 3. version：结构升级的旧草稿自动失效 =====

  it('should return null and clear draft when version mismatch', () => {
    saveDraft(scopeA, { name: 'OldVer' } as never, {
      tokenizedDeposit: null,
      stablecoin: null,
    });
    const key = draftKey(scopeA);
    const draft = readRaw(scopeA);
    draft.version = 2; // 模拟未来结构升级
    window.sessionStorage.setItem(key, JSON.stringify(draft));

    expect(loadDraft(scopeA)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  // ===== 4. 损坏 JSON：解析失败返回 null 并清除 =====

  it('should return null and clear draft when stored value is corrupted JSON', () => {
    const key = draftKey(scopeA);
    window.sessionStorage.setItem(key, '{not-valid-json');

    expect(loadDraft(scopeA)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  // ===== 5. clearDraft 幂等：无草稿时不抛错 =====

  it('should not throw when clearDraft is called with no existing draft (idempotent)', () => {
    expect(window.sessionStorage.getItem(draftKey(scopeA))).toBeNull();
    expect(() => clearDraft(scopeA)).not.toThrow();
    expect(window.sessionStorage.getItem(draftKey(scopeA))).toBeNull();
  });

  // ===== 6. scoped key 隔离：A 的草稿对 B 不可见 =====

  it('should isolate drafts by scope: draft saved for user A is not visible to user B', () => {
    saveDraft(scopeA, { name: 'A Token' } as never, {
      tokenizedDeposit: null,
      stablecoin: null,
    });

    expect(loadDraft(scopeA)).not.toBeNull();
    expect(loadDraft(scopeA)?.formValues.name).toBe('A Token');
    // B 用户读不到 A 的草稿
    expect(loadDraft(scopeB)).toBeNull();
  });

  // ===== 7. saveDraft 返回值：正常 true；storage 抛错时 false 且不 throw =====

  it('should return true on successful save', () => {
    const ok = saveDraft(scopeA, { name: 'X' } as never, {
      tokenizedDeposit: null,
      stablecoin: null,
    });
    expect(ok).toBe(true);
  });

  it('should return false (not throw) when sessionStorage.setItem throws', () => {
    jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    let result: boolean | undefined;
    expect(() => {
      result = saveDraft(scopeA, { name: 'X' } as never, {
        tokenizedDeposit: null,
        stablecoin: null,
      });
    }).not.toThrow();
    expect(result).toBe(false);
  });
});
