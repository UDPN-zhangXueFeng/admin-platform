'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from '@myorg/shared/util-i18n';
import { MockLoginPage, useToast } from '@myorg/shared/ui';
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
  const redirectTarget = searchParams?.get('redirect') || '/dashboard';

  const handleSubmit = React.useCallback(
    async (credentials: { loginName: string; password: string }) => {
      try {
        const resp = await loginMutation.mutateAsync(credentials);

        // Auth context: login() → setAccessToken(token) writes
        // admin_platform_token cookie + localStorage. Middleware reads this
        // cookie. No separate cookie needed.
        const user: User = {
          id: String(resp.userId),
          name: resp.userName,
          email: '',
          roles: [],
          permissions: resp.menuKeys,
          loginName: resp.loginName,
          userType: resp.userType,
          firstLogin: resp.firstLogin,
        };
        login(user, resp.token);

        toast.success('登录成功');

        if (resp.firstLogin === 0) {
          setPwdVisible(true);
          return;
        }

        router.replace(redirectTarget);
      } catch (e) {
        // kissenRequest interceptor throws KissenApiError with a message;
        // surface it to the user (源 relies on interceptor toast, target
        // interceptor only throws).
        toast.error((e as Error).message || '登录失败');
      }
    },
    [loginMutation, login, toast, router, redirectTarget],
  );

  return (
    <>
      {expired && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
        >
          登录已失效，请重新登录
        </div>
      )}
      <MockLoginPage
        projectName="Kissen Admin"
        brandText="Kissen 清算网络"
        brandSuffix="运营管理控制台"
        brandTagline="跨行数字货币清算编排 · 内部运营系统"
        svgPath="/login-illustration.svg"
        redirectPath="/dashboard"
        gradientClass="from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8]"
        brandBaseColor="text-[#001a98]"
        brandAccentColor="text-[#00a5d5]"
        brandSuffixBg="bg-[#00a5d5]"
        taglineColor="text-[#172260]"
        titleColor="text-[#554eea]"
        submitLabel="登 录"
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
