/**
 * LP 域 raw API 层（源 `api/lp.ts`）。
 *
 * 冻结开关复用 freeze 域端点（源 api/freeze.ts，targetType=2 LP）；
 * 其余端点逐字对照源 api/lp.ts。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import { freezeToggle } from '../freeze';
import type {
  LpListReq,
  LpRow,
  LpSaveReq,
  PortalAccountReset,
  PortalAccountStatus,
} from './lp.model';

/** LP 分页列表（POST /manage/lp/list）。 */
export function getLpList(
  req: LpListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpRow>> {
  return kissenPage<LpRow, LpListReq['filter']>(
    '/manage/lp/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * 结算周期配置页 LP 列表（契约导出名；同端点 POST /manage/lp/list，
 * filter 携带 lpName / settleCycle / status——SettleAgent cycle 页消费）。
 */
export function lpSettleCycleList(
  req: LpListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpRow>> {
  return getLpList(req, config);
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

/** LP 门户账号状态（GET /manage/lp/portal-account/:lpId；未开户返回 null）。 */
export function getPortalAccount(
  lpId: number,
  config?: AxiosRequestConfig,
): Promise<PortalAccountStatus | null> {
  return kissenRequest.get<PortalAccountStatus | null>(
    `/manage/lp/portal-account/${lpId}`,
    config,
  );
}

/** 重置门户首管理员口令（POST /manage/lp/portal-account/:lpId/reset；OTP 一次性返回）。 */
export function resetPortalAccount(
  lpId: number,
  config?: AxiosRequestConfig,
): Promise<PortalAccountReset> {
  return kissenRequest.post<PortalAccountReset>(
    `/manage/lp/portal-account/${lpId}/reset`,
    undefined,
    config,
  );
}

/**
 * 结算周期配置（契约导出名；仅此入口可改周期，生效于下一张结算单——
 * POST /manage/lp/settle-cycle，源 api/lp.ts lpSettleCycle）。
 */
export function lpSettleCycleSave(
  req: { lpId: number; settleCycle: number },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp/settle-cycle', req, config);
}

/**
 * 冻结/解冻 LP（立即生效不走审批，规格 R-4；targetType=2）。
 * 复用 freeze 域端点 POST /manage/freeze/toggle，非法状态后端 MSG_21_0067 兜底。
 */
export function lpFreezeToggle(
  targetId: number,
  freeze: boolean,
  config?: AxiosRequestConfig,
): Promise<void> {
  return freezeToggle({ targetType: 2, targetId, freeze }, config);
}
