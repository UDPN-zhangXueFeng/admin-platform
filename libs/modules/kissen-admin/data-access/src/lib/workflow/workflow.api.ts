/**
 * Workflow 域 raw API 层，忠实移植源 `api/workflow.ts`。
 *
 * 路径前缀 `/workflow/*`（kissen-base 服务）。源 list 用 pageSize 500 全量返回，
 * 故通过 {@link kissenPage} 取 `.data` 还原为 `WorkflowRow[]`，不暴露分页 meta。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  BusinessOption,
  WorkflowDetail,
  WorkflowRow,
  WorkflowSaveReq,
  WorkflowUpdateReq,
} from './workflow.model';

/** 审批流列表（源 workflowList：POST /workflow/list，按 busCode 筛选，全量返回）。 */
export function getWorkflowList(
  req: { busCode?: string },
  config?: AxiosRequestConfig,
): Promise<WorkflowRow[]> {
  return kissenPage<WorkflowRow, { businessCode?: string }>(
    '/workflow/list',
    {
      pageNum: 1,
      pageSize: 500,
      filter: { businessCode: req.busCode },
    },
    config,
  ).then((r) => r.data);
}

/** 审批流详情（源 workflowDetail：GET /workflow/detail/{workflowId}）。 */
export function getWorkflowDetail(
  workflowId: number,
  config?: AxiosRequestConfig,
): Promise<WorkflowDetail> {
  return kissenRequest.get<WorkflowDetail>(
    `/workflow/detail/${workflowId}`,
    config,
  );
}

/** 新建审批流（源 workflowSave：POST /workflow/save）。 */
export function workflowSave(
  req: WorkflowSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/workflow/save', req, config);
}

/** 更新审批流（源 workflowUpdate：POST /workflow/update）。 */
export function workflowUpdate(
  req: WorkflowUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/workflow/update', req, config);
}

/** 启停审批流（源 workflowStatus：POST /workflow/status）。1 启用 / 2 失效。 */
export function workflowStatus(
  req: { workflowId: number; status: number },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/workflow/status', req, config);
}

/** 可新增审批流配置的业务（源 workflowBusinesses：POST /workflow/businesses）。 */
export function workflowBusinesses(
  config?: AxiosRequestConfig,
): Promise<BusinessOption[]> {
  return kissenRequest.post<BusinessOption[]>(
    '/workflow/businesses',
    undefined,
    config,
  );
}
