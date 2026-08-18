/**
 * LP 系统菜单域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, <domain>]` 开头做缓存隔离）。
 */
export const menuKeys = {
  all: (projectId: string) => ['project', projectId, 'menu'] as const,
  tree: (projectId: string) => [...menuKeys.all(projectId), 'tree'] as const,
  /** 接口权限维度（按 menuKey 查询；保存后失效整域）。 */
  permissionList: (projectId: string, menuKey: string) =>
    [...menuKeys.all(projectId), 'permissionList', menuKey] as const,
} as const;
