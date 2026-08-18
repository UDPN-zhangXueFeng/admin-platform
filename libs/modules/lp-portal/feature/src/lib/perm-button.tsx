'use client';

/**
 * 按钮级权限（源 `v-perm` 指令等价，A6）。
 *
 * 源语义：`store.menuKeys.has(binding.value)` 为假则 `el.remove()` —— 无
 * key 或无权限一律**移除**（非禁用）。菜单键来自登录响应 menuTree 的全量
 * 展开（含按钮级 menuType=4 节点），登录时写入共享 AuthProvider 的
 * permissions 集合（见 login 页 login() 调用），与平台 PermissionGuard 同源。
 *
 * 用法：
 * ```tsx
 * const canSubmit = usePerm('lp:pool:submit');
 * <PermButton menuKey="lp:pool:submit" onClick={...}>提交</PermButton>
 * ```
 */
import { Button, type ButtonProps } from '@myorg/shared/ui';
import { usePermission } from '@myorg/shared/util-auth';

/**
 * 判断当前会话是否持有指定菜单键（v-perm 语义）。
 *
 * 无 key（undefined/空串）→ false（源指令未传值时同样移除元素）。
 */
export function usePerm(menuKey?: string): boolean {
  const has = usePermission(menuKey ?? '__no_key__');
  return menuKey != null && menuKey !== '' && has;
}

export interface PermButtonProps extends ButtonProps {
  /** 登录响应 menuTree 中的菜单键（如 'lp:pool:submit'）。 */
  menuKey: string;
}

/** 无权限时不渲染（源 v-perm 移除语义）。其余 props 透传 Button。 */
export function PermButton({ menuKey, ...props }: PermButtonProps) {
  const allowed = usePerm(menuKey);
  if (!allowed) return null;
  return <Button {...props} />;
}
