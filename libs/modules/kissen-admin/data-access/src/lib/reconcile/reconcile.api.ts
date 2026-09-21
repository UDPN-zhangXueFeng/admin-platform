import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  ReconcileDiffFilter,
  ReconcileDiffListReq,
  ReconcileDiffRow,
  ReconcileReviewReq,
  ReconcileRunReq,
  ReconcileRunResult,
} from './reconcile.model';

/**
 * 执行对账（POST /manage/reconcile/run）。
 * reconDate 缺省 = 昨日（GMT+8，后端缺省）；返回差异条数。
 */
export function reconcileRun(
  req: ReconcileRunReq,
  config?: AxiosRequestConfig,
): Promise<ReconcileRunResult> {
  return kissenRequest.post<ReconcileRunResult>(
    '/manage/reconcile/run',
    req,
    config,
  );
}

/** 差异分页列表（POST /manage/reconcile/diff/list，{ page, data }；recon_date DESC, diff_id ASC）。 */
export function getReconcileDiffList(
  req: ReconcileDiffListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<ReconcileDiffRow>> {
  return kissenPage<ReconcileDiffRow, ReconcileDiffFilter>(
    '/manage/reconcile/diff/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * 处理差异（POST /manage/reconcile/review）。
 * reviewAction 2 确认 / 3 忽略；仅 status=1 可处理（后端 MSG_21_0068/0069 兜底）。
 */
export function reconcileReview(
  req: ReconcileReviewReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post<void>('/manage/reconcile/review', req, config);
}
