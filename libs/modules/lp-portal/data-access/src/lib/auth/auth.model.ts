/**
 * 认证与菜单模型（源 `src/types/auth.ts` 移植）。
 *
 * 更正：原头注释称「1:1 移植」不实——LoginRespVO 此前遗漏源侧
 * lpCode/lpName/bootstrapReady 三可选字段（FAIL 修复 A 已按源补齐，
 * 逐字命名）；其余形态以源为对照基准。
 *
 * LoginRespVO 整体（含 menuTree）随会话持久化，驱动侧栏装配 / v-perm 按钮权限 /
 * root 落点；LP-3：全角色（含 ROLE_LP_ADMIN）走权限表装配，无 userType 旁路字段。
 */

export interface LoginReq {
  /** LP 编码（源 D1：提交前 trim().toUpperCase()，由页面归一化）。 */
  lpCode: string;
  loginName: string;
  password: string;
}

export interface MenuTreeRespVO {
  menuId: number;
  menuName: string;
  menuNameEn?: string;
  menuKey: string;
  parentId: number;
  /** 0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮 */
  menuType: 0 | 1 | 2 | 3 | 4;
  orderNum: number;
  visible: 0 | 1;
  menuUrl?: string;
  icon?: string;
  children?: MenuTreeRespVO[];
}

export interface LoginRespVO {
  token: string;
  userId: number;
  /** 登录用户所属 LP 数据域 */
  lpId: number;
  loginName: string;
  userName: string;
  /** 0=首次登录需改密 */
  firstLogin: number;
  /** 所属 LP 编码（源同名字段；个人中心「所属 LP」副行展示。可选：旧持久化会话可能缺省） */
  lpCode?: string;
  /** 所属 LP 名称（源同名字段；个人中心第三行主值展示） */
  lpName?: string;
  /** 业务副本初始化完成标记（源 MainLayout：===false → 壳层内容区顶部黄色横幅，提示不硬拒；undefined 不显示） */
  bootstrapReady?: boolean;
  /** 后端按角色装配的可见菜单树,侧栏渲染/按钮权限/根路径落点均由它驱动(LP-3:全角色走权限表,无 userType 旁路) */
  menuTree: MenuTreeRespVO[];
}

export interface ChangePwdReq {
  oldPassword: string;
  newPassword: string;
}

/**
 * 展开菜单树全部 menuKey（含 menuType=4 按钮级、含 visible=1 隐藏节点；
 * 仅 n.menuKey 非空才收集），供 v-perm 等价按钮鉴权与 root 落点候选匹配使用。
 * 源 `src/store/user.ts` flattenKeys 1:1。
 */
export function flattenMenuKeys(nodes: MenuTreeRespVO[]): string[] {
  const keys: string[] = [];
  const walk = (list: MenuTreeRespVO[]) => {
    for (const n of list) {
      if (n.menuKey) keys.push(n.menuKey);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return keys;
}
