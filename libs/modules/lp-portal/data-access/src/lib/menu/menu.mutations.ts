'use client';

/**
 * LP 系统菜单域 mutation hooks（源 `views/system/menu/index.vue` 写操作）。
 *
 * - save/update/remove 成功 → 失效整域（树 + 接口权限维度），对应源 loadTree()
 *   重载后按 menuId 重新定位当前节点；
 * - savePerms 成功 → 失效整域；源 finally「无论成败都按服务端重载」由页面在
 *   onSettled 中再失效 + 清空本地未保存行承担（防已写入行被重复提交）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { menuKeys } from './menu.keys';
import {
  removeMenu,
  saveMenu,
  saveMenuPermission,
  updateMenu,
} from './menu.api';
import type {
  MenuPermissionSaveReq,
  MenuSaveReq,
  MenuUpdateReq,
} from './menu.model';

/** 新增菜单（POST /lp/menu/save）→ 失效菜单域（树 + 权限）。 */
export function useMenuSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuSaveReq) => saveMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/** 更新菜单（POST /lp/menu/update）→ 失效菜单域（树 + 权限）。 */
export function useMenuUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuUpdateReq) => updateMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/** 删除菜单（POST /lp/menu/delete/{menuId}）→ 失效菜单域（树 + 权限）。 */
export function useMenuRemoveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuId: number) => removeMenu(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}

/** 保存接口权限（POST /lp/menu-permission/save，源逐行 for-await 提交由页面循环调用）→ 失效整域。 */
export function useMenuPermissionSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuPermissionSaveReq) => saveMenuPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all(projectId) });
    },
  });
}
