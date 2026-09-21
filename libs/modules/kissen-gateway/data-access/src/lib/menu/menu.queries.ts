'use client';

import { useQuery } from '@tanstack/react-query';

import { getMenuTree } from './menu.api';
import { menuKeys } from './menu.keys';
import type { MenuTree } from './menu.model';

/**
 * 菜单树按权限过滤：保留「节点自身或任一后代命中 menuKey」的节点，
 * 让命中叶子节点的父级分组仍能渲染（保持树结构）。源 store/user.ts filterTree 1:1。
 */
export function filterMenuTree(
  nodes: MenuTree[],
  allowedKeys: Set<string>,
): MenuTree[] {
  const result: MenuTree[] = [];
  for (const node of nodes) {
    const children = node.children?.length
      ? filterMenuTree(node.children, allowedKeys)
      : [];
    if (allowedKeys.has(node.menuKey) || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

/** 全量菜单树（GET /menu/tree）。 */
export function useMenuTreeQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: menuKeys.tree(projectId),
    queryFn: ({ signal }) => getMenuTree({ signal }),
    enabled,
  });
}
