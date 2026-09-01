'use client';

import * as React from 'react';

import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import type { User } from '@myorg/shared/util-auth';
import { MockLoginPage, useToast } from '@myorg/shared/ui';
import { LoginIllustration } from '@/components/brand/login-illustration';
import {
  LP_PROJECT_ID,
  flattenMenuKeys,
  useAuthLoginMutation,
} from '@myorg/modules/lp-portal/data-access';

/**
 * Login route —— /[locale]/login（A3，源 `views/login/index.vue` 真实登录流）。
 *
 *  1. POST /lp/login（mutation onSuccess 已持久化 lp_portal_token cookie +
 *     LoginRespVO 整体，middleware/守卫/侧栏均消费该会话）。
 *  2. 同步共享 AuthProvider：permissions = menuTree 全量 menuKey 展开
 *     （含按钮级），PermButton/usePerm（v-perm 等价）以此鉴权。
 *  3. firstLogin===0 → /change-pwd（强制改密）；否则跳 `?redirect=` 回跳
 *     或 /（root 落点探测）。redirect 由 middleware 写入、带 locale 前缀，
 *     而 locale router 会再补前缀 → 先剥掉，避免 /zh-CN/zh-CN 双前缀。
 *  4. 业务失败（code!=='0'）由 lp-client 拦截器统一 toast（message+traceId），
 *     此处静默（源 axios 拦截器语义）。
 */
export default function LoginRoute() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const loginMutation = useAuthLoginMutation(LP_PROJECT_ID);

  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(
    null,
  );
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  // 401 踢回登录页 → ?expired=1 内联警告条（源 login/index.vue el-alert）。
  const redirectTarget =
    (searchParams?.get('redirect') || '/').replace(
      /^\/(en-US|zh-CN)(?=\/|$)/,
      '',
    ) || '/';

  const expiredNotice =
    searchParams?.get('expired') === '1'
      ? 'Your session has expired. Please sign in again.'
      : undefined;

  // Dev-only credential prefill (internal LP portal test account).
  // Values come from NEXT_PUBLIC_LP_DEV_LP_CODE / NEXT_PUBLIC_LP_DEV_LOGIN_NAME
  // / NEXT_PUBLIC_LP_DEV_PASSWORD (.env.local, template .env.local.example);
  // unset or empty vars leave the field blank. Inactive in production builds
  // via the NODE_ENV gate; inputs are uncontrolled in shared MockLoginPage,
  // so fill them imperatively without overwriting browser autofill.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const fill = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.value) el.value = value;
    };
    fill('lpCode', process.env['NEXT_PUBLIC_LP_DEV_LP_CODE'] ?? '');
    fill('username', process.env['NEXT_PUBLIC_LP_DEV_LOGIN_NAME'] ?? '');
    fill('password', process.env['NEXT_PUBLIC_LP_DEV_PASSWORD'] ?? '');
  }, []);

  const handleSubmit = React.useCallback(
    async (credentials: {
      loginName: string;
      password: string;
      lpCode?: string;
    }) => {
      // 源 D1：lpCode 提交前 trim().toUpperCase()（输入框 uppercase 仅视觉）。
      const payload = {
        lpCode: (credentials.lpCode ?? '').trim().toUpperCase(),
        loginName: credentials.loginName,
        password: credentials.password,
      };
      try {
        const resp = await loginMutation.mutateAsync(payload);

        const user: User = {
          id: String(resp.userId),
          name: resp.userName || resp.loginName,
          email: '',
          roles: [],
          permissions: flattenMenuKeys(resp.menuTree ?? []),
          loginName: resp.loginName,
          firstLogin: resp.firstLogin,
        };
        login(user, resp.token);

        toast.success('Signed in successfully');

        if (resp.firstLogin === 0) {
          router.replace('/change-pwd');
          return;
        }
        router.replace(redirectTarget);
      } catch {
        // lp-client 拦截器已 toast（含 traceId），此处静默。
      }
    },
    [loginMutation, login, toast, router, redirectTarget],
  );

  return (
    <MockLoginPage
      projectName="Kissen LP Portal"
      brandText="kissen"
      brandSuffix="LP"
      brandTagline="Dedicated management portal for liquidity providers"
      illustration={<LoginIllustration className="h-auto max-h-[46vh] w-full max-w-[560px] select-none" />}
      redirectPath="/"
      gradientClass="from-[var(--login-grad-a,#c6c7ff)] via-[var(--login-grad-b,#8e8af5)] to-[var(--login-grad-c,#4e48e8)]"
      brandBaseColor="text-[var(--brand-deep,#001a98)]"
      brandAccentColor="text-[var(--brand-accent,#00a5d5)]"
      brandSuffixBg="bg-[var(--brand-accent,#00a5d5)]"
      taglineColor="text-[var(--brand-deep,#172260)]"
      titleColor="text-[hsl(var(--primary))]"
      formClassName="max-w-[400px]"
      subtitle="Sign in with your LP account credentials"
      submitLabel="Sign In"
      onSubmit={handleSubmit}
      lpCodeField
      warningNotice={expiredNotice}
    />
  );
}
