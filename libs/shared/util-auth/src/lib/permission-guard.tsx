'use client';

import { type ReactNode } from 'react';
import { usePermission } from './auth.hooks';
import type { Permission } from './auth.model';

export interface PermissionGuardProps {
  /** Required permission to render children */
  permission: Permission;
  /** Content rendered when the user lacks the required permission */
  fallback?: ReactNode;
  /** Content rendered when the user has the required permission */
  children: ReactNode;
}

/**
 * Conditional renderer that checks a single permission.
 *
 * Renders `children` when the user holds the required permission,
 * otherwise renders `fallback` (default: `null`).
 *
 * This is a lightweight wrapper around `usePermission` for declarative
 * permission-based UI branching in JSX.
 */
export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const hasPermission = usePermission(permission);
  return hasPermission ? children : fallback;
}
