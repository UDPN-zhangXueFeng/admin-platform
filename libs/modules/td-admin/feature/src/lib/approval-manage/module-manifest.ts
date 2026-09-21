import type { ModuleManifest } from '@myorg/shared/model';

/**
 * approval-manage module manifest — 横切全平台的审批中心（列表三 Tab +
 * 详情 dispatcher 按 busCode 分发 25 审核组件）。
 *
 * 顶层模块（源菜单单条 /approval-manage，非 group），pages 用通用 key
 * { list, detail }，对齐 statements / audit-trail 等顶层模块模式。
 */
export const manifest: ModuleManifest = {
  id: 'approval-manage',
  name: 'Workflow Tasks',
  icon: 'ClipboardCheck',
  routes: [
    {
      path: '/approval-manage',
      component: 'list',
      label: 'Workflow Tasks',
    },
  ],
  permissions: ['approval-manage:view', 'approval-manage:withdraw'],
  i18nNamespace: 'modules.approval-manage',
};
