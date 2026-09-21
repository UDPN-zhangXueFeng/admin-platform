import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Syslog module manifest — 模块"身份证"。
 *
 * module-registry 读取它构建动态路由 / 侧边栏 / 权限守卫。
 * 实际页面组件由 `[module]/[[...slug]]/page.tsx` 经 sys 分组路由解析后加载。
 *
 * 注意：路由路径为 `/sys/sysLog`（保持 stablecoin.json 菜单语义），page.tsx 会把
 * `sys` 当分组、`sysLog` 当子模块名，进而匹配本模块的 registry entry。
 */
export const manifest: ModuleManifest = {
  id: 'syslog',
  name: '系统日志',
  icon: 'FileText',
  routes: [{ path: '/sys/sysLog', component: 'list', label: '系统日志' }],
  permissions: ['syslog:read'],
  i18nNamespace: 'modules.syslog',
};
