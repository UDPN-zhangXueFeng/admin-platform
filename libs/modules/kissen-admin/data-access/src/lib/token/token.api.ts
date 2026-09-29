import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  TokenApproveReq,
  TokenListFilter,
  TokenListPageReq,
  TokenRejectReq,
  TokenRow,
} from './token.model';

/** Token 管理分页列表（POST /manage/token/list）。 */
export function tokenList(
  req: TokenListPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TokenRow>> {
  return kissenPage<TokenRow, TokenListFilter>(
    '/manage/token/list',
    {
      pageNum: req.pageNum,
      pageSize: req.pageSize,
      filter: req.filter,
    },
    config,
  );
}

const TOKEN_LIST_ALL_PAGE_SIZE = 100;

/** 全量列表消费者逐页拉取，避免分页后只拿到首屏 Token。 */
export async function tokenListAll(
  filter: TokenListFilter,
  config?: AxiosRequestConfig,
): Promise<TokenRow[]> {
  const firstPage = await tokenList(
    { pageNum: 1, pageSize: TOKEN_LIST_ALL_PAGE_SIZE, filter },
    config,
  );
  const rows = [...firstPage.data];

  for (
    let pageNum = 2;
    pageNum <= firstPage.pagination.totalPages;
    pageNum += 1
  ) {
    const page = await tokenList(
      { pageNum, pageSize: TOKEN_LIST_ALL_PAGE_SIZE, filter },
      config,
    );
    rows.push(...page.data);
  }

  return rows;
}

/** 审核通过并分配 tokenNo（POST /manage/token/approve）。 */
export function tokenApprove(
  req: TokenApproveReq,
  config?: AxiosRequestConfig,
): Promise<{ tokenNo: string }> {
  return kissenRequest.post<{ tokenNo: string }>(
    '/manage/token/approve',
    req,
    config,
  );
}

/** 驳回注册（POST /manage/token/reject）。 */
export function tokenReject(
  req: TokenRejectReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/token/reject', req, config);
}

/** 调整最低流动性（POST /manage/token/min-liquidity/{tokenId}，body {minLiquidity}）。 */
export function tokenAdjustMinLiquidity(
  tokenId: number,
  minLiquidity: string | number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    `/manage/token/min-liquidity/${tokenId}`,
    { minLiquidity },
    config,
  );
}

/** 停用（POST /manage/token/{tokenId}/disable；仅 status=20 可见）。 */
export function tokenDisable(
  tokenId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/token/${tokenId}/disable`, undefined, config);
}

/** 启用（POST /manage/token/{tokenId}/enable；仅 status=50 可见）。 */
export function tokenEnable(
  tokenId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/token/${tokenId}/enable`, undefined, config);
}
