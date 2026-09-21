'use client';

import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import {
  setAccessToken,
  setStoredUserInfo,
  clearSessionStorage,
  getStoredUserInfo,
} from './auth-token';
import type { User, Permission } from './auth.model';

/**
 * Auth context value shape.
 *
 * Note: `loading` is intentionally omitted from the public API. All auth
 * operations are optimistic — the UI should not block rendering waiting for
 * auth state. If a token refresh or initial session check is needed, handle
 * it imperatively in a layout-level provider or via a query library.
 */
export interface AuthContextValue {
  /** Current user snapshot, or `null` when unauthenticated */
  user: User | null;
  /** Convenience flag derived from `user !== null` */
  isAuthenticated: boolean;
  /** Set of permissions for O(1) lookups */
  permissions: ReadonlySet<Permission>;
  /** Replaces the current session with a new user + token */
  login: (user: User, token: string) => void;
  /** Clears the session and token from persistent storage */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  /** Pre-hydrated user (SSR or restored from an external store). */
  initialUser?: User | null;
  children: ReactNode;
}

/**
 * Provides reactive auth state to the React tree.
 *
 * Design decisions:
 * - Token storage is delegated to `data-access-api` (single source of truth for
 *   localStorage access).
 * - Permissions are stored as a `Set` internally for cheap `has()` checks.
 * - `login` / `logout` are stable callbacks (wrapped in `useCallback`), so
 *   children that consume them via `useAuth` will not re-render unnecessarily.
 */
export function AuthProvider({
  initialUser = null,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    if (initialUser || typeof window === 'undefined') return;

    const storedUser = getStoredUserInfo();
    if (storedUser) {
      setUser(storedUser as User);
    }
  }, [initialUser]);

  const permissions = useMemo(
    () => new Set<Permission>(user?.permissions ?? []),
    [user?.permissions]
  );

  const login = useCallback((nextUser: User, token: string) => {
    setAccessToken(token);
    setStoredUserInfo({
      ...nextUser,
      token,
    });
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearSessionStorage();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      permissions,
      login,
      logout,
    }),
    [user, permissions, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
