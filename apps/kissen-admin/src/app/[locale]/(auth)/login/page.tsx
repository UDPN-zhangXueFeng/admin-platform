'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from '@myorg/shared/util-i18n';
import { MockLoginPage, useToast } from '@myorg/shared/ui';
import { LoginIllustration } from '../../../../components/brand/login-illustration';
import { useAuth } from '@myorg/shared/util-auth';
import type { User } from '@myorg/shared/util-auth';
import {
  useUserLoginMutation,
} from '@myorg/modules/kissen-admin/data-access';

// feature 库在本 app 内为 lazy-loaded（module-page-registry 动态导入），
// 边界规则禁止静态导入 —— 首登改密弹窗仅在交互后渲染，走动态分片。
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/kissen-admin/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

/**
 * Kissen Admin login route — /[locale]/login
 *
 * Real login flow (源 `views/login/index.vue`):
 *  1. POST /rbac/login → LoginRespVO { token, firstLogin, ... }
 *  2. login(user, token) stores token in localStorage + admin_platform_token
 *     cookie (middleware reads this cookie — same as setAccessToken/clearSessionStorage).
 *  3. If firstLogin === 0 → force-mode ChangePasswordDialog (源 `:force="true"`)
 *  4. Else → redirect to `?redirect=` param or /dashboard
 *     (源 login/index.vue:62-63 push(route.query.redirect || '/')).
 */
export default function LoginRoute() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const loginMutation = useUserLoginMutation();
  const [pwdVisible, setPwdVisible] = React.useState(false);

  // 源 login/index.vue:19-22 — 401 踢回登录页时展示「登录已失效」横幅。
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(null);
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);
  const expired = searchParams?.get('expired') === '1';
  const redirectTarget = searchParams?.get('redirect') || '/workbench';

  React.useEffect(() => {
    if (expired) toast.warning('Session expired, please sign in again');
  }, [expired, toast]);

  // Dev-only credential prefill (internal ops console test account).
  // Compiled out of behavior in production via the NODE_ENV gate; inputs are
  // uncontrolled in shared MockLoginPage, so fill them imperatively without
  // overwriting browser autofill.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const fill = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.value) el.value = value;
    };
    fill('username', 'admin');
    fill('password', 'Kissen@123');
  }, []);

  const handleSubmit = React.useCallback(
    async (credentials: { loginName: string; password: string }) => {
      try {
        const resp = await loginMutation.mutateAsync(credentials);

        // Auth context: login() → setAccessToken(token) writes
        // admin_platform_token cookie + localStorage. Middleware reads this
        // cookie. No separate cookie needed.
        const user: User = {
          id: String(resp.userId),
          // English-only console: display the ASCII login name; the backend
          // userName is Chinese (e.g. 系统管理员) and must not surface.
          name: resp.loginName,
          email: '',
          roles: [],
          permissions: resp.menuKeys,
          loginName: resp.loginName,
          userType: resp.userType,
          firstLogin: resp.firstLogin,
          // 源 store/user.ts menuTree —— 侧栏菜单以后端 menuTree 驱动
          // （MainLayout 消费 store.menuTree），随 user 快照进 localStorage，
          // 登出时由 clearSessionStorage 一并清除。
          menuTree: resp.menuTree,
        };
        login(user, resp.token);

        toast.success('Signed in successfully');

        if (resp.firstLogin === 0) {
          setPwdVisible(true);
          return;
        }

        router.replace(redirectTarget);
      } catch (e) {
        // kissenRequest interceptor throws KissenApiError with a message;
        // surface it to the user (源 relies on interceptor toast, target
        // interceptor only throws).
        toast.error((e as Error).message || 'Sign-in failed');
      }
    },
    [loginMutation, login, toast, router, redirectTarget],
  );

  return (
    <>
      <MockLoginPage
        projectName="Kissen Admin"
        brandText="Kissen Clearing Network"
        brandSuffix="Operations Console"
        brandTagline="Interbank digital currency clearing orchestration · Internal operations system"
        illustration={<LoginIllustration />}
        redirectPath="/dashboard"
        brandBaseColor="text-[var(--brand-deep,#0a3d7a)]"
        brandAccentColor="text-[var(--brand-accent,#7fa8d9)]"
        brandSuffixBg="bg-[var(--brand-accent,#7fa8d9)]"
        taglineColor="text-[#1e2635]"
        titleColor="text-[hsl(var(--primary))]"
        submitLabel="Sign In"
        onSubmit={handleSubmit}
      />
      <ChangePasswordDialog
        open={pwdVisible}
        onOpenChange={setPwdVisible}
        force
        onForceDone={() => router.replace(redirectTarget)}
      />
    </>
  );
}
