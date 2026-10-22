/**
 * 汇率查询聚合域 raw API 层（源 `api/fx.ts`）。
 * 2026-10-13 分页清单：/fx/view 改 POST 服务端分页（kissenPage）；行为元数据
 * 消费者（交易页/Overview/Token 详情）走 getFxAllPairs 全量拉取。
 */
import type { AxiosRequestConfig } from 'axios';

import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type { FxPairDetail, FxPairItem, FxViewPageReq } from './fx.model';

/** 元数据全量拉取的单页上限（清单约束 pageSize ≤ 500）。 */
const FX_ALL_PAIRS_PAGE_SIZE = 500;

/**
 * 汇率查询聚合分页（POST /fx/view，GW-14 UDPN 对齐）。
 * 后端约束：`data` 存在时 source/targetTokenSymbol 必须非 null（空串=不过滤），
 * 因此在 wire 边界把缺省字段固化为空串，不透传 undefined/null。
 */
export function getFxView(
  req: FxViewPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<FxPairItem>> {
  return kissenPage<FxPairItem, Required<NonNullable<FxViewPageReq['filter']>>>(
    '/fx/view',
    {
      pageNum: req.pageNum,
      pageSize: req.pageSize,
      filter: {
        sourceTokenSymbol: req.filter?.sourceTokenSymbol ?? '',
        targetTokenSymbol: req.filter?.targetTokenSymbol ?? '',
      },
    },
    config,
  );
}

/**
 * FX 全量 token 对（元数据专用：交易页 pairId→币种/汇率、Overview 图例）。
 * 首页 pageSize 500，按 pagination.totalPages 顺序取余页并按服务端顺序累积；
 * 任一页失败整体 reject（不返回部分数据）；total=0 → []。
 */
export async function getFxAllPairs(
  config?: AxiosRequestConfig,
): Promise<FxPairItem[]> {
  const first = await getFxView(
    { pageNum: 1, pageSize: FX_ALL_PAIRS_PAGE_SIZE, filter: {} },
    config,
  );
  const pairs = [...first.data];
  for (let pageNum = 2; pageNum <= first.pagination.totalPages; pageNum++) {
    const page = await getFxView(
      { pageNum, pageSize: FX_ALL_PAIRS_PAGE_SIZE, filter: {} },
      config,
    );
    pairs.push(...page.data);
  }
  return pairs;
}

/** token 对详情（GET /fx/detail/{pairId}，LP 明细 + 最新/最近汇率快照；无匹配返回 null）。 */
export function getFxPairDetail(
  pairId: number,
  config?: AxiosRequestConfig,
): Promise<FxPairDetail | null> {
  return kissenRequest.get<FxPairDetail | null>(`/fx/detail/${pairId}`, config);
}
