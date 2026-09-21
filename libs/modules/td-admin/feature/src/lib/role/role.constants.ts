/**
 * Role 模块常量。
 *
 * - `ROLE_PERMISSIONS`：6 个后端权限点 UUID（role.md 6.5），原样保留，供行操作按钮
 *   后续接入新权限系统（PermissionGuard）时引用。当前 sys 域尚未接通权限守卫
 *   （与 syslog 一致），UUID 先集中于此避免散落。
 * - `RoleStatus`：状态枚举（0 enabled / 1 disabled）。三个 DTO 注释措辞不一但语义
 *   一致（role.md 7.4），此处统一为 number 语义。
 * - `ROLE_PAGE_SIZE`：列表分页默认，对齐旧页 useCustomTable。
 */

/** 默认每页条数，对齐旧页 useCustomTable 的分页默认。 */
export const ROLE_PAGE_SIZE = 10;

/** 角色 status 枚举：0 启用 / 1 禁用。 */
export const RoleStatus = {
  Enabled: 0,
  Disabled: 1,
} as const;

export type RoleStatusValue = (typeof RoleStatus)[keyof typeof RoleStatus];

/**
 * 6 个后端权限点 UUID（role.md 5.1 / 6.5）。
 *
 * 对应旧页 limit（Add / View / Edit / Disable / Enable / Delete）。新权限系统接通后，
 * 行操作按钮应以这些 UUID 作为 `usePermission(uuid)` 的入参。
 */
export const ROLE_PERMISSIONS = {
  add: '8ba396dfb64b44f29bd4efcf1b4c5522',
  view: 'd3a1e3209f3e48cc81c376c08ef0dfe1',
  edit: '1027ce0cb0bb40148dbf66b7b2d53b26',
  disable: 'b8304095843a46adb10effb4bdfa778e',
  enable: '2c0092da156e4473ac06c2a5d7e8b6a1',
  delete: '696ebbe9e238431fa22f60ec51863cb3',
} as const;
