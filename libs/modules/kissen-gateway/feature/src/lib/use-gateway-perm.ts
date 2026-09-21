'use client';

import * as React from 'react';

import { getGatewayUser } from '@myorg/modules/kissen-gateway/data-access';

/**
 * 按钮级权限（源 directives/perm.ts 的 v-perm 等价物）。
 *
 * 源语义：`v-perm="'bank:user:manage'"` —— gateway 无超管，统一按
 * menuKeys 控制可见性，未命中即移除元素。React 中用
 * `{hasPerm('bank:user:manage') && <Button/>}` 表达。
 */
export function useGatewayPerm() {
  return React.useCallback((menuKey: string): boolean => {
    const user = getGatewayUser();
    return new Set(user?.menuKeys ?? []).has(menuKey);
  }, []);
}
