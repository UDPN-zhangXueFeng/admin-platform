'use client';

/**
 * bank 域 read-query hooks（源 `views/onboard/index.vue` / `views/bank/query.vue` 请求生命周期）。
 */
import { useQuery } from '@tanstack/react-query';

import { bankQueryList, getBankDetail, getBankOnboardStatus } from './bank.api';
import { bankKeys } from './bank.keys';

/** 银行信息详情（实时上行 Kissen；degraded=true 表示已降级本地缓存）。 */
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
