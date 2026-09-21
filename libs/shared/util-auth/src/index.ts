export type { User, Permission, Role } from './lib/auth.model';

export {
  getAccessToken,
  setAccessToken,
  getStoredUserInfo,
  setStoredUserInfo,
  clearSessionStorage,
  removeAccessToken,
  getLoginRedirectPath,
  logoutAndRedirect,
  TOKEN_COOKIE,
} from './lib/auth-token';

export { AuthProvider, type AuthProviderProps } from './lib/auth.context';
export type { AuthContextValue } from './lib/auth.context';

export {
  useAuth,
  usePermission,
  useHasAnyPermission,
} from './lib/auth.hooks';

export { PermissionGuard, type PermissionGuardProps } from './lib/permission-guard';
