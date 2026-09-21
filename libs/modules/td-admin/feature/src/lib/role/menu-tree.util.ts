/**
 * 菜单树父子节点过滤工具（role.md 7.2 高优先级）。
 *
 * 背景：antd Tree 的 `checkedKeys` 若含父节点会自动全选所有子节点，导致详情页误展示。
 * 旧页（view.tsx / edit.tsx）的做法是「收集所有有 children 的父 menuId → 从 menuIdList
 * 中排除」——只把叶子节点作为 checkedKeys 渲染；提交时再把半选父节点合并回去。
 *
 * 此处用结构类型 `{ menuId: number; children?: T[] }` 泛型，**不 import data-access**
 * （type:util 仅可依赖 util/model），UI 层传入自己的节点类型即可复用。
 */

/**
 * 至少具备 menuId 与可选 children 的树节点结构（结构类型，鸭子匹配）。
 *
 * 用非泛型递归结构，使 collectParentMenuIds / filterLeafMenuIds 可被 ui 层
 * （type:ui，禁止依赖 data-access）直接复用，无需 import data-access 的 MenuTreeNode。
 */
export interface MenuTreeNodeLike {
  menuId: number;
  /** 节点名称（i18n key），渲染时由调用方 t()。 */
  menuName?: string;
  children?: MenuTreeNodeLike[];
}

/**
 * 深度遍历菜单树，收集所有「有 children 的父节点 menuId」。
 *
 * 与旧页 view.tsx/edit.tsx 收集 `treeState`（父节点集合）的逻辑 1:1 对齐。
 */
export function collectParentMenuIds(
  nodes: MenuTreeNodeLike[] | undefined | null
): number[] {
  if (!nodes || nodes.length === 0) return [];

  const parentIds: number[] = [];
  const walk = (list: MenuTreeNodeLike[]): void => {
    for (const node of list) {
      if (node.children && node.children.length > 0) {
        parentIds.push(node.menuId);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return parentIds;
}

/**
 * 从一组 menuId 中排除父节点，只保留叶子节点。
 *
 * 用于把后端返回的全集 `menuIdList` 过滤为 Tree 的 checkedKeys（仅叶子），
 * 避免父节点触发全选误展示。与旧页 `menuIdList.filter(id => parentIds.indexOf(id) < 0)` 对齐。
 */
export function filterLeafMenuIds(
  ids: number[] | undefined | null,
  parentIds: number[]
): number[] {
  if (!ids || ids.length === 0) return [];
  return ids.filter((id) => !parentIds.includes(Number(id)));
}
