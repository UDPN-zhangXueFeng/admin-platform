'use client';

import { useQuery } from '@tanstack/react-query';

import { bankGatewayKeys } from './bank-gateway.keys';
import { getBankGatewayInfo } from './bank-gateway.api';

/** 网关连接信息。bankId 缺省时禁用。 */
export function useBankGatewayInfoQuery(
  projectId: string,
  bankId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: bankGatewayKeys.detail(projectId, bankId),
    queryFn: ({ signal }) => getBankGatewayInfo(bankId as number, { signal }),
    enabled: enabled && bankId != null,
  });
}
