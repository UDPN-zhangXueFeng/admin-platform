import type { MenuTree } from '@myorg/modules/kissen-gateway/data-access';

/** Backend menu keys mapped to their registered App Router paths. */
export const MENU_ROUTE_MAP: Record<string, string> = {
  'bank:overview:view': '/overview',
  'bank:onboard:submit': '/onboard',
  'bank:token:manage': '/token/manage',
  'bank:fx:view': '/fx',
  'bank:bankquery:view': '/bank/query',
  'bank:tx:view': '/tx',
  'bank:user:manage': '/system/user',
  'bank:role:manage': '/system/role',
  'bank:menu:manage': '/system/menu',
  'bank:log:view': '/system/log',
  'bank:ui:setting': '/system/ui',
};

/** Return the first visible route below a menu prefix in backend menu order. */
export function findFirstMenuPath(
  nodes: MenuTree[] | undefined,
  module: string,
): string | undefined {
  if (!nodes) return undefined;

  const prefix = `/${module}/`;
  const orderedNodes = nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      if (a.node.orderNum == null || b.node.orderNum == null) {
        return a.index - b.index;
      }
      return a.node.orderNum - b.node.orderNum || a.index - b.index;
    });

  for (const { node } of orderedNodes) {
    if (node.menuType === 4 || node.visible === 1) continue;

    const path = MENU_ROUTE_MAP[node.menuKey];
    if (path?.startsWith(prefix)) return path;

    const nestedPath = findFirstMenuPath(node.children, module);
    if (nestedPath) return nestedPath;
  }

  return undefined;
}
