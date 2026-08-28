import type { InstanceListReq } from './gateway-instance.model';

/** 网关实例域 query key factory（携带 projectId 隔离缓存）。 */
export const gatewayInstanceKeys = {
  all: (projectId: string) =>
    ['project', projectId, 'gateway-instance'] as const,
  lists: (projectId: string) =>
    [...gatewayInstanceKeys.all(projectId), 'list'] as const,
  list: (projectId: string, req: InstanceListReq) =>
    [...gatewayInstanceKeys.lists(projectId), req] as const,
  heartbeat: (projectId: string, instanceId: number, page: number) =>
    [...gatewayInstanceKeys.all(projectId), 'heartbeat', instanceId, page] as const,
} as const;
