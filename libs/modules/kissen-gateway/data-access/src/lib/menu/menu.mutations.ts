'use client';

/**
 * 菜单域 mutation hooks（源 api/menu.ts 写操作 + POST 查询端点）。
 * 写操作成功后失效对应 menuKeys 维度：源保存/删除成功后 load() 重新拉树，
 * React 侧由 invalidate → useMenuTreeQuery 自动重取承担。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getMenuPermissionList,
  removeMenu,
  saveMenu,
  saveMenuPermission,
  updateMenu,
} from './menu.api';
import { menuKeys } from './menu.keys';
import type {
  MenuPermissionSaveReq,
  MenuSaveReq,
  MenuUpdateReq,
} from './menu.model';

/** 新增菜单（POST /menu/save）→ 失效菜单缓存（树 + 权限资源维度）。 */
export function useMenuSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuSaveReq) => saveMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/** 更新菜单（POST /menu/update）→ 失效菜单缓存（树 + 权限资源维度）。 */
export function useMenuUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuUpdateReq) => updateMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/** 删除菜单（POST /menu/delete/:menuId）→ 失效菜单缓存（树 + 权限资源维度）。 */
export function useMenuRemoveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuId: number) => removeMenu(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/**
 * 菜单权限资源列表（POST /menu/menu-permission/list，源 permissionList）。
 * 端点为 POST 查询（无缓存语义），按命令式 mutation 建模；成功后标记
 * permissionList 维度失效（与 saveMenuPermission 的失效维度对齐，当前
 * 无订阅者时为 no-op）。源 gateway 菜单管理页未使用该交互，hook 仅为
 * 端点完整性预置。
 */
export function useMenuPermissionListMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { menuKey?: string }) => getMenuPermissionList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: menuKeys.permissionList(projectId),
      });
    },
  });
}

/** 保存菜单权限资源（POST /menu/menu-permission/save）→ 失效权限资源维度。 */
export function useMenuPermissionSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuPermissionSaveReq) => saveMenuPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: menuKeys.permissionList(projectId),
      });
    },
  });
}
