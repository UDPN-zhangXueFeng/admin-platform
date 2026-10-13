import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { kissenGatewayAxios } from '../kissen-gateway-client';
import { getFxAllPairs, getFxView } from './fx.api';
import type { FxPairItem } from './fx.model';

/**
 * /fx/view 分页与全量聚合口径（2026-10-13 分页清单实测约束）：
 * - wire 上 `data` 存在时两 symbol 字段必须非 null（空串=不过滤），缺省固化 ''；
 * - getFxAllPairs 首页 500 后按 totalPages 顺序取余页，不返回部分数据；
 * - total=0 时单次请求即空数组（不能发起第 2 页请求）。
 */

function pairItem(pairId: number): FxPairItem {
  return {
    tokenPair: {
      pairId,
      sourceTokenCode: `SRC-${pairId}`,
      targetTokenCode: 'TGT',
      userRate: 1,
      status: 20,
    },
    lpNames: [],
    rate: null,
  };
}

function pageResponse(rows: FxPairItem[], total: number): AxiosResponse {
  return {
    data: { code: '0', message: 'ok', data: { rows, page: { total } }, traceId: 't' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  } as AxiosResponse;
}

function errorResponse(traceId: string): AxiosResponse {
  return {
    data: { code: '500', message: 'boom', data: null, traceId },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  } as AxiosResponse;
}

/** 从请求体只收窄分发所需的 pageNum（in/typeof 检查，不做内联断言取值）。 */
function pageNumOf(value: unknown): number {
  if (
    typeof value === 'object' &&
    value !== null &&
    'page' in value &&
    typeof value.page === 'object' &&
    value.page !== null &&
    'pageNum' in value.page &&
    typeof value.page.pageNum === 'number'
  ) {
    return value.page.pageNum;
  }
  throw new Error('unexpected /fx/view request body');
}

/** 拦截适配器：按请求体 pageNum 分发页数据；记录原始请求体供断言。 */
function installAdapter(plan: (pageNum: number) => AxiosResponse): unknown[] {
  const bodies: unknown[] = [];
  kissenGatewayAxios.defaults.adapter = jest.fn(
    async (config: InternalAxiosRequestConfig) => {
      const parsed: unknown = JSON.parse(String(config.data));
      bodies.push(parsed);
      return plan(pageNumOf(parsed));
    },
    // 适配器签名与 axios 类型存在结构差异（mock 固定返回 AxiosResponse），
    // 测试边界整体断言一次。
  ) as unknown as typeof kissenGatewayAxios.defaults.adapter;
  return bodies;
}

describe('getFxView wire contract', () => {
  const originalAdapter = kissenGatewayAxios.defaults.adapter;

  afterEach(() => {
    kissenGatewayAxios.defaults.adapter = originalAdapter;
  });

  it('coerces absent filter fields to empty strings (backend rejects null symbols)', async () => {
    const bodies = installAdapter(() => pageResponse([], 0));
    const result = await getFxView({ pageNum: 1, pageSize: 10, filter: {} });

    expect(bodies[0]).toEqual({
      page: { pageNum: 1, pageSize: 10 },
      // 后端实测：data 存在时 symbol 为 null/缺失 → code=1；空串 = 不过滤。
      data: { sourceTokenSymbol: '', targetTokenSymbol: '' },
    });
    expect(result.pagination.total).toBe(0);
  });
});

describe('getFxAllPairs pagination aggregation', () => {
  const originalAdapter = kissenGatewayAxios.defaults.adapter;

  afterEach(() => {
    kissenGatewayAxios.defaults.adapter = originalAdapter;
  });

  it('fetches sequential pages up to totalPages and keeps server order', async () => {
    const bodies = installAdapter((pageNum) =>
      pageNum === 1 ? pageResponse([pairItem(1)], 501) : pageResponse([pairItem(501)], 501),
    );

    const pairs = await getFxAllPairs();

    // total=501、pageSize=500 → 2 页；第 2 页数据可达（跨页边界完整性）。
    expect(pairs.map((p) => p.tokenPair.pairId)).toEqual([1, 501]);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({
      page: { pageNum: 2, pageSize: 500 },
      data: { sourceTokenSymbol: '', targetTokenSymbol: '' },
    });
  });

  it('rejects the whole aggregation when any page fails (no partial data)', async () => {
    installAdapter((pageNum) =>
      pageNum === 1 ? pageResponse([pairItem(1)], 501) : errorResponse('t-page2'),
    );

    await expect(getFxAllPairs()).rejects.toMatchObject({
      code: '500',
    });
  });

  it('returns an empty array with a single request when total is 0', async () => {
    const bodies = installAdapter(() => pageResponse([], 0));

    await expect(getFxAllPairs()).resolves.toEqual([]);
    expect(bodies).toHaveLength(1);
  });
});
