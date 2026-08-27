import {
  KissenApiError,
  kissenGatewayAxios,
  sanitizeKissenMessage,
} from './kissen-gateway-client';

/**
 * 错误文案口径（约束 1：用户可见字符串零中文）：
 * 后端错误 message 为中文（如「未登录或登录已过期」），禁止透传到 toast，
 * 英文原样保留、中文/空缺以 code 维度兜底；traceId 拼接口径同步锁定。
 */
describe('sanitizeKissenMessage', () => {
  it('replaces CJK backend messages with a code-scoped English fallback', () => {
    // 后端实测（87，2026-08-27）：code '2' message=「未登录或登录已过期」。
    expect(sanitizeKissenMessage('未登录或登录已过期', '2')).toBe(
      'Request failed (code 2)',
    );
  });

  it('passes English backend messages through unchanged', () => {
    // 英文信息有排障价值，不丢弃。
    expect(sanitizeKissenMessage('duplicate login name', '1001')).toBe(
      'duplicate login name',
    );
  });

  it('falls back when the message is missing or blank', () => {
    expect(sanitizeKissenMessage(undefined, '9')).toBe('Request failed (code 9)');
    expect(sanitizeKissenMessage('   ', '9')).toBe('Request failed (code 9)');
  });
});

describe('KissenApiError message composition', () => {
  it('appends traceId for on-screen `message (traceId)` semantics', () => {
    const err = new KissenApiError('500', 'boom', 'trace-1');
    expect(err.message).toBe('boom (trace-1)');
    expect(new KissenApiError('500', 'boom').message).toBe('boom');
  });
});

/**
 * 会话过期链路（实测口径：后端返回 HTTP 200 + code '2'，从不发 401）：
 * client 必须双判 code '2' 并按 401 语义拒绝（清会话/跳转副作用），不能当成普通业务错误。
 */
describe('response interceptor session-expiry branch', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("rejects with the English session-expired error for HTTP 200 + code '2'", async () => {
    kissenGatewayAxios.defaults.adapter = jest.fn().mockResolvedValue({
      data: { code: '2', message: '未登录或登录已过期', data: null, traceId: 't-1' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    }) as unknown as typeof kissenGatewayAxios.defaults.adapter;

    await expect(kissenGatewayAxios.get('/user/page')).rejects.toMatchObject({
      name: 'KissenApiError',
      code: '2',
      message: 'Session expired. Please sign in again (t-1)',
    });
  });

  it('sanitizes CJK messages for non-session business errors', async () => {
    kissenGatewayAxios.defaults.adapter = jest.fn().mockResolvedValue({
      data: { code: '1001', message: '该登录名已存在', data: null, traceId: 't-2' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    }) as unknown as typeof kissenGatewayAxios.defaults.adapter;

    await expect(kissenGatewayAxios.post('/user/create', {})).rejects.toMatchObject(
      {
        name: 'KissenApiError',
        code: '1001',
        message: 'Request failed (code 1001) (t-2)',
      },
    );
  });
});
