'use client';

import * as React from 'react';
import { useAuth } from '@myorg/shared/util-auth';

/**
 * 源 `src/directives/perm.ts`（v-perm）的 React 等价物。
 *
 * 语义：非超管（userType !== 0）且登录响应 menuKeys 不含 menuKey 时，
 * 按钮不渲染（源是 el.remove()，目标直接条件渲染）。超管 userType === 0
 * 恒放行。menuKeys 由 login/page.tsx 存入 user.permissions。
 *
 * 用法：
 * ```tsx
 * const hasPerm = useKissenPerm();
 * {hasPerm('rbac:user:manage') && <Button>新增用户</Button>}
 * ```
 */
export function useKissenPerm(): (menuKey: string) => boolean {
  const { user } = useAuth();
  const isSuperAdmin = user?.userType === 0;
  const granted = user?.permissions ?? [];

  return React.useCallback(
    (menuKey: string) => isSuperAdmin || granted.includes(menuKey),
    [isSuperAdmin, granted],
  );
}
