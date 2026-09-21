'use client';

/**
 * LP 系统角色域 read-query hooks。
 *
 * keepPreviousData：翻页/改筛选重取期间保留上次成功数据（源 rows 不清空的
 * 等价）；错误不吞，由 lp-client 拦截器统一提示。
 *
 * 另含 user 页角色选项薄切片（原 role-api-only.ts 并入）：源 loadRoles 用
 * pageSize:200 一次拉足作下拉选项，不分页翻取、不做前端搜索（角色量级小，
 * 源即如此取舍）；失败仅下拉为空（源 catch 静默），不影响主列表。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { roleKeys } from './role.keys';
import { getRoleMenuIds, getRoleOptionsPage, getRolePage } from './role.api';
import type { RolePageReq } from './role.model';

/** 角色分页列表（POST /lp/role/page）。 */
export function useRolePageQuery(projectId: string, params: RolePageReq) {
  return useQuery({
    queryKey: roleKeys.list(projectId, params),
    queryFn: ({ signal }) => getRolePage(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 角色选项查询（user 页新增/编辑/分配角色弹窗共用；pageSize:200 一次拉足）。 */
export function useRoleOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: roleKeys.options(projectId),
    queryFn: ({ signal }) => getRoleOptionsPage({ signal }),
    enabled,
  });
}

/**
 * 角色已分配菜单 id 集（GET /lp/role/menuIds/{roleId}）。
 * 弹窗按 roleId 挂载即取（源 onMounted loadChecked 等价）；
 * 叶子过滤在页面做（此处返回全量 id）。
 */
export function useRoleMenuIdsQuery(
  projectId: string,
  roleId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: roleKeys.menuIds(projectId, roleId),
    queryFn: ({ signal }) => getRoleMenuIds(roleId, { signal }),
    enabled,
  });
}
