'use client';

/** 网关实例域 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { instanceHeartbeatPage, instanceList } from './gateway-instance.api';
import { gatewayInstanceKeys } from './gateway-instance.keys';
import type { InstanceListReq } from './gateway-instance.model';

/** 实例分页列表（keepPreviousData 保持翻页时表格稳定）。 */
export function useInstanceListQuery(
  projectId: string,
  req: InstanceListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: gatewayInstanceKeys.list(projectId, req),
    queryFn: ({ signal }) => instanceList(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 心跳分页（抽屉打开时启用；pageSize 固定 10）。 */
export function useInstanceHeartbeatQuery(
  projectId: string,
  instanceId: number | null,
  page: number,
  pageSize = 10,
  enabled = true,
) {
  return useQuery({
    queryKey: gatewayInstanceKeys.heartbeat(
      projectId,
      instanceId ?? 0,
      page,
    ),
    queryFn: ({ signal }) =>
      instanceHeartbeatPage(instanceId as number, page, pageSize, { signal }),
    placeholderData: keepPreviousData,
    enabled: enabled && instanceId != null,
  });
}
