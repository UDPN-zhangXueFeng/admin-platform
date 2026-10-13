'use client';

/**
 * bank 域 read-query hooks（源 `views/onboard/index.vue` / `views/bank/query.vue` 请求生命周期）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  bankQueryDetail,
  bankQueryList,
  getBankDetail,
  getBankInfo,
  getBankOnboardStatus,
} from './bank.api';
import { bankKeys } from './bank.keys';
import type { BankQueryPageReq } from './bank.model';

/** 银行信息推送缓存（Kissen 推送；onboard 页 bankId 兜底展示）。 */
export function useBankInfoQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.bankInfo(),
    queryFn: ({ signal }) => getBankInfo({ signal }),
    enabled,
  });
}

/** 银行信息详情（GW-17 纯本地化：本行库组装，新鲜度靠 G-14 推送/入网查询回写）。 */
export function useBankDetailQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.detail(),
    queryFn: ({ signal }) => getBankDetail({ signal }),
    enabled,
  });
}

/** 入网申请状态（GET /bank/onboard/status；status===20 已入网，门控消费方）。 */
export function useBankOnboardStatusQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.onboardStatus(),
    queryFn: ({ signal }) => getBankOnboardStatus({ signal }),
    enabled,
  });
}

/** 网络银行分页列表（POST /bank/query/list，keyword 模糊；翻页/换筛选保留旧页）。 */
export function useBankQueryListQuery(req: BankQueryPageReq, enabled = true) {
  return useQuery({
    queryKey: bankKeys.queryList(req),
    queryFn: ({ signal }) => bankQueryList(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 网络银行详情（GET /bank/query/detail/{bankId}，eafcab0；无匹配返回 null，页面按空态处理）。 */
export function useBankQueryDetailQuery(bankId: number | undefined) {
  return useQuery({
    queryKey: bankKeys.queryDetail(bankId ?? 0),
    queryFn: ({ signal }) => bankQueryDetail(bankId as number, { signal }),
    enabled: bankId != null && Number.isFinite(bankId),
  });
}
