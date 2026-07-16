'use client';

import { useContext, useMemo } from 'react';
import { AuthContext, type AuthContextValue } from './auth.context';
import type { Permission } from './auth.model';

function throwMissingProvider(): never {
  throw new Error(
    'useAuth() was called outside of an <AuthProvider>. ' +
      'Wrap your component tree in <AuthProvider> before consuming auth state.'
  );
}

/**
 * Returns the full auth context value.
 *
 * Typical usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * ```
 *
 * @throws If called outside of an `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throwMissingProvider();
  return ctx;
}

/**
 * Checks whether the current user holds a single permission.
 *
 * Returns `false` when unauthenticated.
 *
 * @example
 * const canDeleteUser = usePermission('user:delete');
 */
export function usePermission(permission: Permission): boolean {
  const { permissions } = useAuth();
  return permissions.has(permission);
}

/**
 * Checks whether the current user holds **any** of the provided permissions.
 *
 * Returns `false` when unauthenticated or when `permissions` array is empty.
 *
 * @example
 * const canReadOrWrite = useHasAnyPermission(['user:read', 'user:write']);
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const { permissions: userPermissions } = useAuth();
  return useMemo(
    () => permissions.some((p) => userPermissions.has(p)),
    [permissions, userPermissions]
  );
}
