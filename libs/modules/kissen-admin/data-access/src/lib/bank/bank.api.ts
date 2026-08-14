import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  BankApprovalDetailResp,
  BankApprovalDoneRow,
  BankApprovalPageReq,
  BankApprovalTodoRow,
  BankFreezeReq,
  BankLimitChangeReq,
  BankListFilter,
  BankListReq,
  BankRow,
  BankSaveReq,
  BankSubmitOnboardReq,
} from './bank.model';

/* ------------------------------------------------------------------ */
/* 银行 CRUD / 入网 / 限额 / 冻结                                       */
/* ------------------------------------------------------------------ */

/** 银行分页列表（POST /manage/bank/list）。 */
export function getBankList(
  req: BankListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<BankRow>> {
  return kissenPage<BankRow, BankListFilter>(
    '/manage/bank/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

export function getBankDetail(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<BankRow> {
  return kissenRequest.get<BankRow>(`/manage/bank/detail/${bankId}`, config);
}

export function saveBank(req: BankSaveReq): Promise<{ bankId: number }> {
  return kissenRequest.post('/manage/bank/save', req);
}

/** 草稿（status=1）或被拒（15）提交入网申请，进入审批中心待办。 */
export function submitBankOnboard(req: BankSubmitOnboardReq): Promise<void> {
  return kissenRequest.post('/manage/bank/onboard/submit', req);
}

/**
 * 限额变更（KLC）：仅已启用银行（status=20）；返回待生效记录 ID。
 * 同银行进行中重复提交由后端 MSG_21_0071 兜底。
 */
export function bankLimitChange(req: BankLimitChangeReq): Promise<{ changeId: number }> {
  return kissenRequest.post('/manage/bank/limit-change', req);
}

/**
 * 已入网银行支持币种并集（跨组共享契约，计划 §2）。
 * 货币对弹窗币种下拉数据源；并集外保存由后端 MSG_21_0076 兜底。
 */
export function getBankSupportedCurrencies(
  config?: AxiosRequestConfig,
): Promise<string[]> {
  return kissenRequest.get<string[]>('/manage/bank/supported-currencies', config);
}

/**
 * 银行冻结/解冻薄调用（POST /manage/freeze/toggle；targetType=1 银行）。
 * 立即生效不走审批（规格 R-4）；状态校验后端 MSG_21_0067 兜底（仅 20→50 / 50→20）。
 */
export function toggleBankFreeze(req: BankFreezeReq): Promise<void> {
  return kissenRequest.post('/manage/freeze/toggle', {
    targetType: 1,
    targetId: req.bankId,
    freeze: req.freeze,
  });
}

/* ------------------------------------------------------------------ */
/* 银行审批薄调用（/mult/approval/*；bank 域限定业务编码）              */
/* ------------------------------------------------------------------ */

/** 银行审批待办分页。 */
export function getBankApprovalTodoPage(
  req: { pageNum: number; pageSize: number; data: BankApprovalPageReq },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<BankApprovalTodoRow>> {
  return kissenPage<BankApprovalTodoRow, BankApprovalPageReq>(
    '/mult/approval/todoPage',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.data },
    config,
  );
}

/** 银行审批已办分页。 */
export function getBankApprovalDonePage(
  req: { pageNum: number; pageSize: number; data: BankApprovalPageReq },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<BankApprovalDoneRow>> {
  return kissenPage<BankApprovalDoneRow, BankApprovalPageReq>(
    '/mult/approval/donePage',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.data },
    config,
  );
}

/** 审批详情（业务内容 + 操作能力位）。 */
export function getBankApprovalDetail(
  req: { busCode: string; taskId: number },
  config?: AxiosRequestConfig,
): Promise<BankApprovalDetailResp> {
  return kissenRequest.post<BankApprovalDetailResp>('/mult/approval/detail', req, config);
}

/** 审批处理：approve 3 通过 / 2 拒绝。 */
export function processBankApproval(req: {
  busCode: string;
  taskId: number;
  approve: number;
  remarks?: string;
}): Promise<void> {
  return kissenRequest.post('/mult/approval/process', req);
}

/** 退回上一步（remarks 必填）。 */
export function previousStepBankApproval(req: {
  busCode: string;
  taskId: number;
  remarks: string;
}): Promise<void> {
  return kissenRequest.post('/mult/approval/previousStep', req);
}

/** 撤回：仅待审核（5）且发起人本人可撤；后端 MSG_26_0006/0007 兜底。 */
export function withdrawBankApproval(req: {
  busCode: string;
  taskId: number;
  remarks?: string;
}): Promise<void> {
  return kissenRequest.post('/mult/approval/withdraw', req);
}
