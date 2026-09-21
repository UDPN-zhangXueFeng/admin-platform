/**
 * LP 系统菜单域模型（源 `types/system.ts` 菜单/接口权限段）。
 *
 * 行/请求 VO 集中定义在 `../types`（源 1:1 平移，barrel 已 star 导出），
 * 此处仅重导出同一声明，不重复定义（避免 pool 域曾出现的同名歧义）。
 */
export type {
  MenuTree,
  MenuSaveReq,
  MenuUpdateReq,
  MenuPermissionRow,
  MenuPermissionItem,
  MenuPermissionSaveReq,
} from '../types';

/** 菜单类型文案（源 类型下拉 el-option label `N 文案`；0 模块〜4 按钮）。 */
export const MENU_TYPE_TEXT: Record<number, string> = {
  0: 'Module',
  1: 'System',
  2: 'Level-1 Menu',
  3: 'Level-2 Menu',
  4: 'Button',
};
