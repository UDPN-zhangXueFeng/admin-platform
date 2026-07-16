/**
 * mmf API endpoint 覆盖单测（分母 12，非脚本输出的 10）。
 *
 * 验收（mmf.md 第9章 / 第8章风险点）：
 *   - 12 个 endpoint 全部在 mmf.api.ts 实现，迁移率 ≥98%。
 *   - 含脚本漏抓的 `/apply`（applyAccrualRecord）+ `/batch/apply/list`
 *     （getBatchApplyList）+ 2 个 list。
 *
 * 策略（Rule 5：确定性变换用代码而非模型）：mock apiClient，记录每次调用的
 * (url, data)，断言：①命中正确 URL；②payload 形态正确；③列表函数注入 `id`
 * 满足 DataTable 契约。
 */
import {
  applyAccrualRecord,
  getAccrualDetail,
  getAccrualRecordList,
  getAccrualWalletRecords,
  getBatchApplyList,
  getBlockchainList,
  getFundList,
  getSettlementApprovalRecords,
  getSettlementDetail,
  getSettlementRecordList,
  getSettlementWalletRecords,
  getStablecoinSearches,
} from './mmf.api';
import {
  calls,
  resetCalls,
  setResponse,
} from './__mocks__/data-access-api';

const ENDPOINT = {
  accrualList: '/api/manage/v1/manage/dividend/accrual/record/list',
  accrualDetail: '/api/manage/v1/manage/dividend/accrual/record/detail',
  accrualWalletRecords:
    '/api/manage/v1/manage/dividend/accrual/record/wallet/records',
  accrualFundList: '/api/manage/v1/manage/dividend/accrual/record/fund/list',
  batchApplyList:
    '/api/manage/v1/manage/dividend/accrual/record/batch/apply/list',
  apply: '/api/manage/v1/manage/dividend/accrual/record/apply',
  settlementList:
    '/api/manage/v1/manage/dividend/settlement/record/list',
  settlementDetail:
    '/api/manage/v1/manage/dividend/settlement/record/detail',
  settlementWalletRecords:
    '/api/manage/v1/manage/dividend/settlement/record/wallet/records',
  settlementRecordList:
    '/api/manage/v1/manage/dividend/settlement/record/record/list',
  stablecoinSearches: '/api/manage/v1/common/stablecoin/enabled/searches',
  blockchainList: '/api/manage/v1/common/blockchain/list',
} as const;

function lastCall() {
  return calls[calls.length - 1];
}

describe('mmf.api — 12 endpoints wired correctly (denominator 12)', () => {
  beforeEach(() => resetCalls());

  // ── 列表 API（2）──
  it('getAccrualRecordList posts to accrual list with { data, page } and injects row id', async () => {
    setResponse(ENDPOINT.accrualList, {
      page: { total: 1 },
      rows: [{ accrualRecordId: 7, fundName: 'F1' }],
    });
    const res = await getAccrualRecordList({
      pageNum: 1,
      pageSize: 10,
      filters: { status: 5 },
    });
    expect(lastCall().url).toBe(ENDPOINT.accrualList);
    expect(lastCall().data).toEqual({
      data: { status: 5 },
      page: { pageNum: 1, pageSize: 10 },
    });
    // 注入 id = String(accrualRecordId) 满足 DataTable 契约。
    expect(res.rows[0].id).toBe('7');
  });

  it('getSettlementRecordList posts to settlement list and injects row id', async () => {
    setResponse(ENDPOINT.settlementList, {
      page: { total: 1 },
      rows: [{ settlementId: 9, settlementCode: 'S-9' }],
    });
    const res = await getSettlementRecordList({
      pageNum: 2,
      pageSize: 20,
      filters: { settlementCode: 'S' },
    });
    expect(lastCall().url).toBe(ENDPOINT.settlementList);
    expect(lastCall().data).toEqual({
      data: { settlementCode: 'S' },
      page: { pageNum: 2, pageSize: 20 },
    });
    expect(res.rows[0].id).toBe('9');
  });

  // ── 详情 API（2）──
  it('getAccrualDetail posts accrualRecordId as a number to the detail endpoint', async () => {
    setResponse(ENDPOINT.accrualDetail, { status: 35 });
    await getAccrualDetail('42');
    expect(lastCall().url).toBe(ENDPOINT.accrualDetail);
    expect(lastCall().data).toEqual({ accrualRecordId: 42 });
  });

  it('getSettlementDetail posts settlementId as a number to the detail endpoint', async () => {
    setResponse(ENDPOINT.settlementDetail, { settlementCode: 'S' });
    await getSettlementDetail('88');
    expect(lastCall().url).toBe(ENDPOINT.settlementDetail);
    expect(lastCall().data).toEqual({ settlementId: 88 });
  });

  it('getAccrualDetail unwraps a null backend payload to undefined (not null)', async () => {
    setResponse(ENDPOINT.accrualDetail, null);
    await expect(getAccrualDetail(1)).resolves.toBeUndefined();
  });

  // ── 子查询 API（3）──
  it('getAccrualWalletRecords posts { data, page } to the accrual wallet-records endpoint', async () => {
    setResponse(ENDPOINT.accrualWalletRecords, { rows: [] });
    await getAccrualWalletRecords({
      pageNum: 1,
      pageSize: 10,
      filters: { walletAddress: '0x1', billCode: 'B1' },
    });
    expect(lastCall().url).toBe(ENDPOINT.accrualWalletRecords);
    expect(lastCall().data).toEqual({
      data: { walletAddress: '0x1', billCode: 'B1' },
      page: { pageNum: 1, pageSize: 10 },
    });
  });

  it('getSettlementWalletRecords posts filters + settlementId to settlement wallet-records', async () => {
    setResponse(ENDPOINT.settlementWalletRecords, { rows: [] });
    await getSettlementWalletRecords({
      pageNum: 1,
      pageSize: 10,
      filters: { settlementId: 5, status: 20, walletAddress: '0x2' },
    });
    expect(lastCall().url).toBe(ENDPOINT.settlementWalletRecords);
    expect((lastCall().data as { data: unknown }).data).toEqual({
      settlementId: 5,
      status: 20,
      walletAddress: '0x2',
    });
  });

  it('getSettlementApprovalRecords posts settlementId to the approval-records endpoint', async () => {
    setResponse(ENDPOINT.settlementRecordList, { rows: [] });
    await getSettlementApprovalRecords({
      pageNum: 1,
      pageSize: 10,
      filters: { settlementId: 3 },
    });
    expect(lastCall().url).toBe(ENDPOINT.settlementRecordList);
    expect((lastCall().data as { data: unknown }).data).toEqual({
      settlementId: 3,
    });
  });

  // ── 基金下拉（1）──
  it('getFundList posts an empty body to the shared fund/list endpoint', async () => {
    setResponse(ENDPOINT.accrualFundList, [{ ruleId: 1, fundName: 'F1' }]);
    await getFundList();
    expect(lastCall().url).toBe(ENDPOINT.accrualFundList);
    expect(lastCall().data).toEqual({});
  });

  // ── 批量申报查询（1，脚本漏抓）──
  it('getBatchApplyList posts the raw params (no envelope) to batch/apply/list — the endpoint the meta script missed', async () => {
    setResponse(ENDPOINT.batchApplyList, []);
    await getBatchApplyList({
      ruleId: 1,
      accrualTimeStartDate: 1000,
      accrualTimeEndDate: 2000,
    });
    expect(lastCall().url).toBe(ENDPOINT.batchApplyList);
    // 非分页，payload 直接是查询参数本身。
    expect(lastCall().data).toEqual({
      ruleId: 1,
      accrualTimeStartDate: 1000,
      accrualTimeEndDate: 2000,
    });
  });

  // ── 申报写入（1，脚本漏抓）──
  it('applyAccrualRecord posts the apply DTO directly to /apply — the write endpoint the meta script missed', async () => {
    const dto = {
      applyReqVOList: [{ accrualRecordId: 7, accrualUnits: 100 }],
      ruleId: 1,
      totalAccrualUnits: 100,
    };
    await applyAccrualRecord(dto);
    expect(lastCall().url).toBe(ENDPOINT.apply);
    expect(lastCall().data).toEqual(dto);
  });

  // ── 公共下拉（2）──
  it('getStablecoinSearches GETs the stablecoin searches endpoint', async () => {
    setResponse(ENDPOINT.stablecoinSearches, []);
    await getStablecoinSearches();
    expect(lastCall().url).toBe(ENDPOINT.stablecoinSearches);
  });

  it('getBlockchainList GETs the blockchain list endpoint', async () => {
    setResponse(ENDPOINT.blockchainList, []);
    await getBlockchainList();
    expect(lastCall().url).toBe(ENDPOINT.blockchainList);
  });

  // ── 分母自校验：所有 12 个 URL 互不相同 ──
  it('every documented endpoint is a distinct URL (no two functions share a route)', () => {
    const urls = Object.values(ENDPOINT);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBe(12);
  });
});
