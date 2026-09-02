'use client';

/**
 * bank 域 read-query hooks（源 `views/onboard/index.vue` / `views/bank/query.vue` 请求生命周期）。
 */
import { useQuery } from '@tanstack/react-query';

import {
  bankQueryDetail,
  bankQueryList,
  getBankDetail,
  getBankInfo,
  getBankOnboardStatus,
} from './bank.api';
import { bankKeys } from './bank.keys';

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

/** 网络银行列表（GW-14 UDPN 对齐：gw_bank_info 权限可见集合）。 */
export function useBankQueryListQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.queryList(),
    queryFn: ({ signal }) => bankQueryList({ signal }),
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
