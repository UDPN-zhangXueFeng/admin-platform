'use client';

/**
 * LP 系统菜单域 read-query hooks。
 *
 * 错误不吞（lp-client 拦截器统一 toast）；树重取后页面按 menuId 重新定位
 * 当前节点（源 loadTree 同款语义，由页面 useEffect 承担）。
 */
import { useQuery } from '@tanstack/react-query';

import { menuKeys } from './menu.keys';
import { getMenuPermissionList, getMenuTree } from './menu.api';

/** 菜单树（GET /lp/menu/tree）。 */
export function useMenuTreeQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: menuKeys.tree(projectId),
    queryFn: ({ signal }) => getMenuTree({ signal }),
    enabled,
  });
}

/** 接口权限列表（POST /lp/menu-permission/list，按 menuKey 查；新建未保存节点禁用）。 */
export function useMenuPermissionListQuery(
  projectId: string,
  menuKey: string,
  enabled = true,
) {
  return useQuery({
    queryKey: menuKeys.permissionList(projectId, menuKey),
    queryFn: ({ signal }) => getMenuPermissionList({ menuKey }, { signal }),
    enabled: enabled && menuKey !== '',
  });
}
