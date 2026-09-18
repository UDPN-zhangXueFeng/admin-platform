/**
 * User 模块权限点常量（user.md §6）。
 *
 * 6 个后端操作各对应一个权限点 UUID（源自 td-manage 旧页 `limit` 字段）。sys 域尚未
 * 接通新权限守卫（与 role/syslog 一致），UUID 集中于此避免散落，待 PermissionGuard
 * 接入后由行操作按钮以 `usePermission(uuid)` 引用。
 *
 * 旧 UUID → 操作映射（user.md §5.1 / §6）：
 *  - add     f19251c8…  新增
 *  - view    e28cbe7e…  查看
 *  - edit    2b4786e4…  编辑
 *  - disable f3020790…  禁用
 *  - enable  3b4a04b1…  启用
 *  - reset   93dcbe20…  重置密码
 *  - delete  3a206682…  删除
 */
export const USER_PERMISSIONS = {
  add: 'f19251c8a9af489283cf578bf3d18861',
  view: 'e28cbe7e27de4e09823eb304ba2f8033',
  edit: '2b4786e42917444eb8590847cbca9ff5',
  disable: 'f3020790b1de4d99950eb6998bcef3cb',
  enable: '3b4a04b114ad44528e879c248ac8ce83',
  reset: '93dcbe20a20a436d82ecfa72ac0f7f3e',
  delete: '3a206682772543b0bc5cf754adf6dac4',
} as const;

export type UserPermission = keyof typeof USER_PERMISSIONS;
