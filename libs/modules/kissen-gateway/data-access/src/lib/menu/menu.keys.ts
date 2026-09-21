/** 菜单域 query key factory（维度：project → menu）。 */
export const menuKeys = {
  all: (projectId: string) => ['project', projectId, 'menu'] as const,
  tree: (projectId: string) =>
    ['project', projectId, 'menu', 'tree'] as const,
  permissionList: (projectId: string) =>
    ['project', projectId, 'menu', 'permissionList'] as const,
};
