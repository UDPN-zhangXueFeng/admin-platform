/**
 * LP 域 raw API 层（源 `api/lp.ts`）。
 *
 * 跨组依赖（货币对选项、冻结开关）以薄调用方式落在本域，避免并行耦合他组 data-access。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import {
  LP_FREEZE_TARGET_TYPE,
  type CurrencyPairOption,
  type LpFreezeReq,
  type LpListFilter,
  type LpListReq,
  type LpRow,
  type LpSaveReq,
} from './lp.model';

/** LP 分页列表（POST /manage/lp/list）。 */
export function getLpList(
  req: LpListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpRow>> {
  return kissenPage<LpRow, LpListFilter>(
    '/manage/lp/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** LP 详情 / 编辑回填（GET /manage/lp/detail/:lpId）。 */
export function getLpDetail(
  lpId: number,
  config?: AxiosRequestConfig,
): Promise<LpRow> {
  return kissenRequest.get<LpRow>(`/manage/lp/detail/${lpId}`, config);
}

/** 新建/编辑 LP（草稿；POST /manage/lp/save）。 */
export function saveLp(
  req: LpSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ lpId: number }> {
  return kissenRequest.post('/manage/lp/save', req, config);
}

/** 提交入网申请（进入审批中心待办；POST /manage/lp/onboard/submit）。 */
export function submitLpOnboard(
  lpId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp/onboard/submit', { lpId }, config);
}

/**
 * 货币对选项（LP 表单 initialPairIds 多选数据源）。
 * 薄调用 POST /manage/currency-pair/list（跨组 currency-pair 域，端点读源 api/currency-pair.ts）。
 */
export async function getLpCurrencyPairOptions(
  config?: AxiosRequestConfig,
): Promise<CurrencyPairOption[]> {
  const res = await kissenPage<CurrencyPairOption, Record<string, unknown>>(
    '/manage/currency-pair/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}

/**
 * 冻结/解冻 LP（立即生效不走审批；规格 R-4）。
 * 薄调用 POST /manage/freeze/toggle（跨组 freeze 域，端点读源 api/freeze.ts）。
 */
export function lpFreezeToggle(
  targetId: number,
  freeze: boolean,
  config?: AxiosRequestConfig,
): Promise<void> {
  const req: LpFreezeReq = {
    targetType: LP_FREEZE_TARGET_TYPE,
    targetId,
    freeze,
  };
  return kissenRequest.post('/manage/freeze/toggle', req, config);
}
