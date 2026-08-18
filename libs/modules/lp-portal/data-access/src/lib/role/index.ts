/**
 * LP 系统角色域 barrel（源 `api/role.ts` + `views/system/role/*`）。
 *
 * 五件套：model / keys / api / queries / mutations。原 user 页专用的
 * 角色选项薄切片（role-api-only.ts）已并入本域（useRoleOptionsQuery）。
 */
export * from './role.model';
export * from './role.keys';
export * from './role.api';
export * from './role.queries';
export * from './role.mutations';
