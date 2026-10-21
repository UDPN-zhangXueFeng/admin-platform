import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  ApprovalApplyListReq,
  ApprovalApplyPageReq,
  ApprovalApplyRow,
  ApprovalBusinessDetailReq,
  ApprovalBusinessDetailResp,
  ApprovalDetailResp,
  ApprovalDoneRow,
  ApprovalListReq,
  ApprovalPageReq,
  ApprovalTodoRow,
} from './approval.model';

/** 审批待办分页（POST /mult/approval/todoPage；分页体 { page, data }）。 */
export function getApprovalTodoPage(
  req: ApprovalListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<ApprovalTodoRow>> {
  return kissenPage<ApprovalTodoRow, ApprovalPageReq>(
    '/mult/approval/todoPage',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 审批已办分页（POST /mult/approval/donePage；分页体 { page, data }）。 */
export function getApprovalDonePage(
  req: ApprovalListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<ApprovalDoneRow>> {
  return kissenPage<ApprovalDoneRow, ApprovalPageReq>(
    '/mult/approval/donePage',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 审批详情（POST /mult/approval/detail；返回业务内容 + 可用操作能力位）。 */
export function getApprovalDetail(
  req: { busCode: string; taskId: number },
  config?: AxiosRequestConfig,
): Promise<ApprovalDetailResp> {
  return kissenRequest.post('/mult/approval/detail', req, config);
}

/** 审批处理：approve 3 通过 / 2 拒绝（POST /mult/approval/process）。 */
export function approvalProcess(
  req: {
    busCode: string;
    taskId: number;
    approve: number;
    remarks?: string;
  },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/mult/approval/process', req, config);
}

/** 退回上一步（POST /mult/approval/previousStep；remarks 必填）。 */
export function approvalPreviousStep(
  req: { busCode: string; taskId: number; remarks: string },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/mult/approval/previousStep', req, config);
}

/** 撤回：仅待审核(5)且发起人本人（POST /mult/approval/withdraw）。 */
export function approvalWithdraw(
  req: { busCode: string; taskId: number; remarks?: string },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/mult/approval/withdraw', req, config);
}

/** 业务键审批详情（POST /mult/approval/detailByBusiness；优先在途任务，否则最新历史）。 */
export function getApprovalDetailByBusiness(
  req: ApprovalBusinessDetailReq,
  config?: AxiosRequestConfig,
): Promise<ApprovalBusinessDetailResp> {
  return kissenRequest.post('/mult/approval/detailByBusiness', req, config);
}

/** 我发起的分页（POST /mult/approval/applyPage；按当前身份过滤 create_user_id）。 */
export function getApprovalApplyPage(
  req: ApprovalApplyListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<ApprovalApplyRow>> {
  return kissenPage<ApprovalApplyRow, ApprovalApplyPageReq>(
    '/mult/approval/applyPage',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}
