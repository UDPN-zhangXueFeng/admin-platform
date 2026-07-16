/**
 * blockchain API endpoint 覆盖单测（分母 14）。
 *
 * 验收（blockchain.md 第9章 / 第8章风险点）：
 *   - 14 个 endpoint 全部在 blockchain.api.ts 实现，迁移率 ≥98%
 *     （分母 = 14 真实 endpoint，非脚本误报的 18）。
 *   - 含脚本漏抓的 sftp/download（动态拼接 URL，blob 响应）。
 *   - detail endpoint 拼写保持 `detial`（typo，后端依赖此拼写）。
 *   - 三个 list 接口请求体用 `pageNum`/`pageSize`（非 page，硬约束 #5）。
 *   - 下载函数解析 content-disposition 的 `utf-8''` 文件名。
 *
 * 策略（Rule 5：确定性变换用代码而非模型）：mock apiClient，记录每次调用的
 * (url, data)，断言：①命中正确 URL；②payload 形态正确；③列表函数注入 `id`
 * 满足 DataTable 契约。下载函数用 fetch + DOM spy 单独覆盖（不经 apiClient）。
 *
 * 对齐 mmf.api.spec.ts（已验收范本），结构一致。
 */
import {
  downloadSmartContract,
  editNode,
  getBlockchainList,
  getDeploymentDetail,
  getDeploymentList,
  getNodeDetail,
  getNodeList,
  getNodeLocationList,
  getNodeParamsDetail,
  getSmartContractList,
  getStablecoinSearches,
  getTokenTypeList,
  saveNode,
  updateNodeState,
} from './blockchain.api';
import {
  calls,
  resetCalls,
  setResponse,
} from './__mocks__/data-access-api';

const ENDPOINT = {
  // 列表（3）
  deploymentList: '/api/manage/v1/contract/deployment/listPage',
  nodeList: '/api/manage/v1/node/manage/list',
  smartContractList: '/api/manage/v1/contract/manage/list',
  // 详情（2，含拼写错误的 detial）
  deploymentDetails: '/api/manage/v1/contract/deployment/details',
  nodeDetail: '/api/manage/v1/node/manage/detial',
  // node 写操作（4）
  nodeAdd: '/api/manage/v1/node/manage/add',
  nodeEdit: '/api/manage/v1/node/manage/edit',
  nodeUpdateState: '/api/manage/v1/node/manage/updateState',
  nodeParamsSearch: '/api/manage/v1/node/manage/add/params/search',
  // 公共下拉（4）
  blockchainList: '/api/manage/v1/common/blockchain/list',
  nodeLocationList: '/api/manage/v1/common/nodeLocation/list',
  stablecoinSearches: '/api/manage/v1/common/stablecoin/enabled/searches',
  tokenTypeList: '/api/manage/v1/common/tokenType/list',
} as const;

function lastCall() {
  return calls[calls.length - 1];
}

describe('blockchain.api — 列表 API（3，请求体 pageNum 非 page）', () => {
  beforeEach(() => resetCalls());

  it('getDeploymentList posts { data, page:{pageNum,pageSize} } and injects row id', async () => {
    setResponse(ENDPOINT.deploymentList, {
      page: { total: 1 },
      rows: [{ recordId: 7, tdName: 'T1' }],
    });
    const res = await getDeploymentList({
      pageNum: 1,
      pageSize: 10,
      filters: { tdId: '5' },
    });
    expect(lastCall().url).toBe(ENDPOINT.deploymentList);
    expect(lastCall().data).toEqual({
      data: { tdId: '5' },
      page: { pageNum: 1, pageSize: 10 },
    });
    // 硬约束 #5：分页字段必须是 pageNum，绝不能是 page（列表数据不显示）。
    expect((lastCall().data as { page: Record<string, unknown> }).page).toHaveProperty('pageNum');
    expect((lastCall().data as { page: Record<string, unknown> }).page).not.toHaveProperty('page');
    // 注入 id = String(recordId) 满足 DataTable 契约。
    expect(res.rows[0].id).toBe('7');
  });

  it('getNodeList posts pageNum body and injects id = String(blockchainAccessId)', async () => {
    setResponse(ENDPOINT.nodeList, {
      page: { total: 1 },
      rows: [{ blockchainAccessId: 9, blockchainName: 'ETH' }],
    });
    const res = await getNodeList({
      pageNum: 2,
      pageSize: 20,
      filters: { chainId: '1' },
    });
    expect(lastCall().url).toBe(ENDPOINT.nodeList);
    expect(lastCall().data).toEqual({
      data: { chainId: '1' },
      page: { pageNum: 2, pageSize: 20 },
    });
    expect(res.rows[0].id).toBe('9');
  });

  it('getSmartContractList posts pageNum body and injects id = String(packageId)', async () => {
    setResponse(ENDPOINT.smartContractList, {
      page: { total: 1 },
      rows: [{ packageId: 11, packageNameWithSuffix: 'P.zip' }],
    });
    const res = await getSmartContractList({
      pageNum: 1,
      pageSize: 10,
      filters: { smartPackageName: 'P' },
    });
    expect(lastCall().url).toBe(ENDPOINT.smartContractList);
    expect((lastCall().data as { page: Record<string, unknown> }).page).toHaveProperty('pageNum');
    expect(res.rows[0].id).toBe('11');
  });

  it('treats a missing rows array as empty (no crash, defensive map)', async () => {
    setResponse(ENDPOINT.nodeList, { page: { total: 0 } });
    const res = await getNodeList({ pageNum: 1, pageSize: 10 });
    expect(res.rows).toEqual([]);
  });
});

describe('blockchain.api — 详情 API（2，detial 拼写保持）', () => {
  beforeEach(() => resetCalls());

  it('getDeploymentDetail posts { recordId }', async () => {
    setResponse(ENDPOINT.deploymentDetails, { tdName: 'T', detailList: [] });
    await getDeploymentDetail('42');
    expect(lastCall().url).toBe(ENDPOINT.deploymentDetails);
    expect(lastCall().data).toEqual({ recordId: '42' });
  });

  it('getDeploymentDetail unwraps a null backend payload to undefined', async () => {
    setResponse(ENDPOINT.deploymentDetails, null);
    await expect(getDeploymentDetail(1)).resolves.toBeUndefined();
  });

  // 硬约束：endpoint 拼写保持 detial（typo），后端依赖此拼写，不要"修正"。
  it('getNodeDetail posts to the typo endpoint /node/manage/detial (NOT detail)', async () => {
    setResponse(ENDPOINT.nodeDetail, {
      blockchainId: '1',
      nodeParamsDetail: [],
    });
    await getNodeDetail('1', '2');
    expect(lastCall().url).toBe(ENDPOINT.nodeDetail);
    expect(lastCall().data).toEqual({ blockchainId: '1', nodeLocationId: '2' });
    // 明确断言拼写：url 末段是 detial，禁止被"优化"成 detail。
    expect(lastCall().url.endsWith('/detial')).toBe(true);
    expect(lastCall().url.endsWith('/detail')).toBe(false);
  });
});

describe('blockchain.api — node 写操作 API（4）', () => {
  beforeEach(() => resetCalls());

  it('saveNode posts the save DTO to /node/manage/add', async () => {
    const dto = {
      blockchainId: '1',
      nodeLocationId: '2',
      browserUrl: 'https://etherscan.io',
      nodeParamsDetail: [],
    };
    await saveNode(dto);
    expect(lastCall().url).toBe(ENDPOINT.nodeAdd);
    expect(lastCall().data).toEqual(dto);
  });

  it('editNode posts the edit DTO to /node/manage/edit', async () => {
    const dto = {
      blockchainId: '1',
      nodeLocationId: '2',
      browserUrl: 'https://etherscan.io',
      nodeParamsDetail: [{ paramKey: 'k', paramName: 'n', paramValue: 'v' }],
    };
    await editNode(dto);
    expect(lastCall().url).toBe(ENDPOINT.nodeEdit);
    expect(lastCall().data).toEqual(dto);
  });

  it('updateNodeState posts { blockchainId, nodeLocationId, state } (1/2/3 shared endpoint)', async () => {
    await updateNodeState({
      blockchainId: '1',
      nodeLocationId: '2',
      state: 3,
    });
    expect(lastCall().url).toBe(ENDPOINT.nodeUpdateState);
    expect(lastCall().data).toEqual({
      blockchainId: '1',
      nodeLocationId: '2',
      state: 3,
    });
  });

  it('getNodeParamsDetail posts to /node/manage/add/params/search and returns nodeParamsDetail', async () => {
    setResponse(ENDPOINT.nodeParamsSearch, {
      nodeParamsDetail: [
        { paramKey: 'rpc', paramName: 'RPC', paramValue: '' },
      ],
    });
    const res = await getNodeParamsDetail({
      blockchainId: '1',
      nodeLocationId: '2',
    });
    expect(lastCall().url).toBe(ENDPOINT.nodeParamsSearch);
    expect(res.nodeParamsDetail).toHaveLength(1);
    expect(res.nodeParamsDetail[0].paramKey).toBe('rpc');
  });
});

describe('blockchain.api — 公共下拉 API（4）', () => {
  beforeEach(() => resetCalls());

  it('getBlockchainList GETs the blockchain dropdown endpoint', async () => {
    setResponse(ENDPOINT.blockchainList, []);
    await getBlockchainList();
    expect(lastCall().url).toBe(ENDPOINT.blockchainList);
  });

  it('getNodeLocationList POSTs an empty body to the node-location dropdown', async () => {
    setResponse(ENDPOINT.nodeLocationList, []);
    await getNodeLocationList();
    expect(lastCall().url).toBe(ENDPOINT.nodeLocationList);
    expect(lastCall().data).toEqual({});
  });

  it('getStablecoinSearches GETs the stablecoin searches endpoint', async () => {
    setResponse(ENDPOINT.stablecoinSearches, []);
    await getStablecoinSearches();
    expect(lastCall().url).toBe(ENDPOINT.stablecoinSearches);
  });

  it('getTokenTypeList GETs the token-type list endpoint', async () => {
    setResponse(ENDPOINT.tokenTypeList, []);
    await getTokenTypeList();
    expect(lastCall().url).toBe(ENDPOINT.tokenTypeList);
  });
});

// ── 脚本漏抓的下载 endpoint（动态拼接 URL，不经 apiClient，单独覆盖）──
describe('blockchain.api — downloadSmartContract (sftp/download blob，脚本漏抓)', () => {
  const FILE_ID = 'https://files.example.com';

  /** 捕获 fetch 调用 + 受控返回（含 content-disposition 文件名）。 */
  function mockFetch(opts: {
    ok: boolean;
    status?: number;
    blob?: () => Promise<Blob>;
    disposition?: string;
  }) {
    return jest.fn().mockResolvedValue({
      ok: opts.ok,
      status: opts.status ?? 200,
      blob:
        opts.blob ??
        (() =>
          Promise.resolve(
            new Blob(['x'], { type: 'application/vnd.ms-excel' }),
          )),
      headers: new Headers(
        opts.disposition ? { 'content-disposition': opts.disposition } : {},
      ),
    });
  }

  /**
   * 安装 DOM/fetch stubs 并返回「重置」函数。
   *
   * URL.createObjectURL / URL.revokeObjectURL 在 jsdom 下可能不可枚举，
   * spyOn 会抛 "Property does not exist"，故直接用 Object.defineProperty
   * 赋值（保存原值，重置时还原）。document.createElement 同理直接覆写，
   * 捕获 <a> 的 download / click 以断言文件名解析与触发。
   */
  function installDomStubs(opts: { captureDownload?: boolean } = {}) {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn().mockReturnValue('blob:fake'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    let capturedDownload: string | undefined;
    let clickSpy: jest.Mock | undefined;
    const realCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = realCreate(tag);
      if (opts.captureDownload) {
        Object.defineProperty(el, 'download', {
          configurable: true,
          get: () => capturedDownload,
          set: (v: string) => {
            capturedDownload = v;
          },
        });
      } else {
        clickSpy = jest.fn();
        el.click = clickSpy;
      }
      return el;
    }) as typeof document.createElement;

    return {
      capturedDownload: () => capturedDownload,
      clickSpy: () => clickSpy,
      restore: () => {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          writable: true,
          value: originalCreate,
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
          configurable: true,
          writable: true,
          value: originalRevoke,
        });
        document.createElement = realCreate;
      },
    };
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_FILE_ID = FILE_ID;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FILE_ID;
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    jest.restoreAllMocks();
  });

  it('builds the dynamic sftp/download URL with busId + busType query params (脚本未抓全)', async () => {
    const fn = mockFetch({ ok: true });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs();

    await downloadSmartContract({ busId: '77', busType: 'pkg' });

    expect(fn).toHaveBeenCalledTimes(1);
    const calledUrl = String((fn.mock.calls[0] as unknown[])[0]);
    // 真实 URL 是模板拼接，脚本静态扫描漏抓；此处验证拼接结果正确。
    expect(calledUrl).toBe(`${FILE_ID}/v1/sftp/download?busId=77&busType=pkg`);
    dom.restore();
  });

  it('parses the filename from content-disposition `utf-8\'\'` segment', async () => {
    const fn = mockFetch({
      ok: true,
      disposition: "attachment; filename*=utf-8''smart-contract-2024.xlsx",
    });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs({ captureDownload: true });

    await downloadSmartContract({ busId: '1', busType: 'pkg' });
    // 硬约束：文件名从 content-disposition 的 utf-8'' 分割解析后 decode。
    expect(dom.capturedDownload()).toBe('smart-contract-2024.xlsx');
    dom.restore();
  });

  it('falls back to a default filename when content-disposition is absent', async () => {
    const fn = mockFetch({ ok: true });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs({ captureDownload: true });

    await downloadSmartContract({ busId: '1', busType: 'pkg' });
    expect(dom.capturedDownload()).toBe('smart-contract.xlsx');
    dom.restore();
  });

  it('attaches the localStorage token header when present', async () => {
    window.localStorage.setItem('admin_platform_access_token', 'abc123');
    const fn = mockFetch({ ok: true });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs();

    await downloadSmartContract({ busId: '1', busType: 'pkg' });
    const headers = (fn.mock.calls[0] as unknown[])[1] as {
      headers?: Record<string, string>;
    };
    expect(headers?.headers).toEqual({ token: 'abc123' });
    dom.restore();
  });

  it('omits the token header when localStorage has no token', async () => {
    const fn = mockFetch({ ok: true });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs();

    await downloadSmartContract({ busId: '1', busType: 'pkg' });
    const headers = (fn.mock.calls[0] as unknown[])[1] as {
      headers?: Record<string, string>;
    };
    // 无 token 时传空 headers 对象（不挂 token 键）。
    expect(headers?.headers).toEqual({});
    dom.restore();
  });

  it('throws when the response is not ok (Download failed)', async () => {
    const fn = mockFetch({ ok: false, status: 500 });
    global.fetch = fn as unknown as typeof global.fetch;
    const dom = installDomStubs();

    await expect(
      downloadSmartContract({ busId: '1', busType: 'pkg' }),
    ).rejects.toThrow('Download failed');
    dom.restore();
  });
});

// ── 分母自校验：13 个 apiClient URL 互不相同 ──
describe('blockchain.api — endpoint denominator (14 endpoints)', () => {
  // 13 个走 apiClient（list 3 + detail 2 + node 写 4 + 下拉 4），
  // 加上 1 个不经 apiClient 的 sftp/download（动态拼接）= 14 真实 endpoint。
  // （脚本误报 18：整组导出 common.ts/node.ts 把未引用的 bank/list、
  //   resources/search、wallet/keystore、password/modify、accessKey/get 也计入，
  //   本模块实际不迁移。）
  it('every apiClient endpoint is a distinct URL', () => {
    const urls = Object.values(ENDPOINT);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBe(13);
  });

  it('the sftp/download endpoint is NOT in the apiClient list (it bypasses the envelope)', () => {
    const urls = Object.values(ENDPOINT).map((u) => String(u));
    expect(urls.some((u) => u.includes('sftp/download'))).toBe(false);
  });
});
