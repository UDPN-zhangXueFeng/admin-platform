/** 菜单树节点（源 types/system.ts MenuTree，字段 1:1）。 */
export interface MenuTree {
  menuId: number;
  menuName: string;
  menuNameEn?: string;
  menuKey: string;
  parentId?: number;
  /** 0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮 */
  menuType?: number;
  orderNum?: number;
  /** 0 显示 / 1 隐藏 */
  visible?: number;
  menuUrl?: string;
  icon?: string;
  children?: MenuTree[];
}

export interface MenuSaveReq {
  menuName: string;
  menuNameEn: string;
  menuKey: string;
  parentId?: number;
  menuType?: number;
  orderNum?: number;
  visible?: number;
  menuUrl?: string;
  icon?: string;
}

export interface MenuUpdateReq {
  menuId: number;
  menuName?: string;
  menuNameEn?: string;
  orderNum?: number;
  visible?: number;
  menuUrl?: string;
  icon?: string;
}

/** 后端 MenuPermissionRespVO（/menu/menu-permission/list 返回行）。 */
export interface MenuPermissionRow {
  menuPermissionId: number;
  menuId: number;
  menuKey: string;
  resourceUrl: string;
  httpMethod: string;
  resourceType: number;
  permissionType: number;
}

export interface MenuPermissionSaveReq {
  menuId: number;
  menuKey?: string;
  resourceUrl?: string;
  httpMethod?: string;
  permissionType?: number;
}
