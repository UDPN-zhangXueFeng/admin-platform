'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { MockLoginPage, useToast } from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import type { User } from '@myorg/shared/util-auth';
import {
  useUserLoginMutation,
} from '@myorg/modules/kissen-admin/data-access';
import { ChangePasswordDialog } from '@myorg/modules/kissen-admin/feature';

/**
 * Kissen Admin login route — /[locale]/login
 *
 * Real login flow (源 `views/login/index.vue`):
 *  1. POST /rbac/login → LoginRespVO { token, firstLogin, ... }
 *  2. login(user, token) stores token in localStorage + admin_platform_token
 *     cookie (middleware reads this cookie — same as setAccessToken/clearSessionStorage).
 *  3. If firstLogin === 0 → force-mode ChangePasswordDialog (源 `:force="true"`)
 *  4. Else → redirect to /dashboard
 */
export default function LoginRoute() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const loginMutation = useUserLoginMutation();
  const [pwdVisible, setPwdVisible] = React.useState(false);

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

        router.replace('/dashboard');
      } catch (e) {
        // kissenRequest interceptor throws KissenApiError with a message;
        // surface it to the user (源 relies on interceptor toast, target
        // interceptor only throws).
        toast.error((e as Error).message || '登录失败');
      }
    },
    [loginMutation, login, toast, router],
  );

  return (
    <>
      <MockLoginPage
        projectName="Kissen Admin"
        brandText="kissen"
        brandSuffix="Admin"
        brandTagline="Stablecoin settlement and liquidity operations console."
        svgPath="/login-illustration.svg"
        redirectPath="/dashboard"
        gradientClass="from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8]"
        brandBaseColor="text-[#001a98]"
        brandAccentColor="text-[#00a5d5]"
        brandSuffixBg="bg-[#00a5d5]"
        taglineColor="text-[#172260]"
        titleColor="text-[#554eea]"
        submitLabel="Sign In"
        onSubmit={handleSubmit}
      />
      <ChangePasswordDialog
        open={pwdVisible}
        onOpenChange={setPwdVisible}
        force
        onForceDone={() => router.replace('/dashboard')}
      />
    </>
  );
}
