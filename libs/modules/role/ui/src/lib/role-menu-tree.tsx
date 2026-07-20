'use client';

import * as React from 'react';
import { Checkbox } from '@myorg/shared/ui';
import {
  collectParentMenuIds,
  filterLeafMenuIds,
  type MenuTreeNodeLike,
} from '@myorg/modules/role/util';

export interface RoleMenuTreeProps {
  /** 全量菜单树（queryAllMenu 返回）。结构类型，兼容 data-access 的 MenuTreeNode。 */
  menuList: MenuTreeNodeLike[];
  /**
   * 当前选中菜单 ID 全集（含父节点，对齐后端 menuIdList 语义）。
   * 仅叶子会作为 checkedKeys 渲染（避免父节点触发全选误展示，role.md 7.2）。
   */
  checkedMenuIds: number[];
  /** true=只读（详情页），false=可勾选（编辑页）。 */
  disabled?: boolean;
  /**
   * i18n 翻译函数。菜单节点的 menuName 为后端返回的 i18n key（如 'Router_0010_2'），
   * 传入 t() 后渲染时调用 translate(menuName) 得到译文。
   * 未传时退化为直接渲染 menuName 原文。
   */
  translate?: (key: string) => string;
  /**
   * 勾选变化回调。返回「叶子+全选父」(checkedKeys) 与「半选父」(halfCheckedKeys)。
   * 提交给后端的是两者合并（role.md 5.3），由调用方合并。
   */
  onCheck?: (checkedKeys: number[], halfCheckedKeys: number[]) => void;
}

/**
 * RoleMenuTree — 菜单授权树（封装父子节点勾选过滤，role.md 5.2/5.3/7.2）。
 *
 * 不依赖 antd Tree（项目未安装 antd），采用最简自渲染递归 Checkbox 实现，
 * 复用 menu-tree.util 的 collectParentMenuIds / filterLeafMenuIds 保证与旧页
 * 「收集父节点 → 过滤叶子」逻辑 1:1。
 *
 * 状态语义（tri-state）：
 *   - checked：节点在选中集 且（若是父节点）所有子叶子均选中。
 *   - indeterminate：父节点下部分子选中（半选）。
 *   - unchecked：未选中。
 *
 * 勾选行为：勾选/取消一个节点 = 级联其全部后代叶子；父链半选状态由后代自动推导。
 */
export function RoleMenuTree({
  menuList,
  checkedMenuIds,
  disabled = false,
  translate,
  onCheck,
}: RoleMenuTreeProps) {
  const checkedSet = React.useMemo(
    () => new Set(checkedMenuIds.map(Number)),
    [checkedMenuIds]
  );

  // 渲染时只把叶子作为 checkedKeys（避免父节点触发 antd 式全选误展示，role.md 7.2）。
  const parentIds = React.useMemo(
    () => collectParentMenuIds(menuList),
    [menuList]
  );
  const leafCheckedIds = React.useMemo(
    () => filterLeafMenuIds(checkedMenuIds, parentIds),
    [checkedMenuIds, parentIds]
  );

  /**
   * 计算节点 tri-state。
   * - 叶子：checked = 在 checkedSet。
   * - 父：checked = 所有子叶子均选中；indeterminate = 部分选中。
   */
  const getState = React.useCallback(
    (node: MenuTreeNodeLike): { checked: boolean; indeterminate: boolean } => {
      if (!node.children?.length) {
        return { checked: checkedSet.has(node.menuId), indeterminate: false };
      }
      // 父节点：递归收集其所有后代叶子，判断全选/部分。
      const leafIds: number[] = [];
      const collectLeaves = (n: MenuTreeNodeLike): void => {
        if (!n.children?.length) {
          leafIds.push(n.menuId);
        } else {
          n.children.forEach(collectLeaves);
        }
      };
      collectLeaves(node);
      const selectedCount = leafIds.filter((id) => checkedSet.has(id)).length;
      return {
        checked: leafIds.length > 0 && selectedCount === leafIds.length,
        indeterminate: selectedCount > 0 && selectedCount < leafIds.length,
      };
    },
    [checkedSet]
  );

  /**
   * 切换某节点的勾选：级联所有后代（含自身）一并加入或移除，再回传完整集。
   * checkedKeys = 全选节点（叶子 + 全选父）；halfCheckedKeys = 半选父（role.md 5.3）。
   */
  const toggle = React.useCallback(
    (node: MenuTreeNodeLike, nextChecked: boolean) => {
      if (disabled || !onCheck) return;

      // 以叶子选中集为基础重算全集（避免父节点污染）。勾选某节点 = 级联其全部后代叶子。
      const baseLeaves = new Set(leafCheckedIds);

      const apply = (n: MenuTreeNodeLike): void => {
        if (!n.children?.length) {
          if (nextChecked) baseLeaves.add(n.menuId);
          else baseLeaves.delete(n.menuId);
        } else {
          n.children?.forEach(apply);
        }
      };
      apply(node);

      // 由叶子集重新推导每个节点的 checked/indeterminate，回传对应 menuId。
      const checkedKeys: number[] = [];
      const halfCheckedKeys: number[] = [];

      const walk = (n: MenuTreeNodeLike): void => {
        if (!n.children?.length) {
          if (baseLeaves.has(n.menuId)) checkedKeys.push(n.menuId);
        } else {
          const leafIds: number[] = [];
          const collectLeaves = (x: MenuTreeNodeLike): void => {
            if (!x.children?.length) leafIds.push(x.menuId);
            else x.children.forEach(collectLeaves);
          };
          collectLeaves(n);
          const selected = leafIds.filter((id) => baseLeaves.has(id)).length;
          if (leafIds.length > 0 && selected === leafIds.length) {
            checkedKeys.push(n.menuId);
          } else if (selected > 0) {
            halfCheckedKeys.push(n.menuId);
          }
          n.children.forEach(walk);
        }
      };
      menuList.forEach(walk);

      onCheck(checkedKeys, halfCheckedKeys);
    },
    [disabled, onCheck, leafCheckedIds, menuList]
  );

  return (
    <div className="space-y-1">
      {menuList.map((node) => (
        <RoleMenuTreeNode
          key={node.menuId}
          node={node}
          depth={0}
          disabled={disabled}
          translate={translate}
          getState={getState}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

interface RoleMenuTreeNodeProps {
  node: MenuTreeNodeLike;
  depth: number;
  disabled: boolean;
  translate?: (key: string) => string;
  getState: (node: MenuTreeNodeLike) => { checked: boolean; indeterminate: boolean };
  onToggle: (node: MenuTreeNodeLike, nextChecked: boolean) => void;
}

function RoleMenuTreeNode({
  node,
  depth,
  disabled,
  translate,
  getState,
  onToggle,
}: RoleMenuTreeNodeProps) {
  const { checked, indeterminate } = getState(node);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        <Checkbox
          checked={indeterminate ? 'indeterminate' : checked}
          disabled={disabled}
          onCheckedChange={(value) => onToggle(node, value === true)}
        />
        <span className="text-sm">{node.menuName && translate ? translate(node.menuName) : node.menuName}</span>
      </div>
      {node.children?.length
        ? node.children.map((child) => (
            <RoleMenuTreeNode
              key={child.menuId}
              node={child}
              depth={depth + 1}
              disabled={disabled}
              translate={translate}
              getState={getState}
              onToggle={onToggle}
            />
          ))
        : null}
    </div>
  );
}
