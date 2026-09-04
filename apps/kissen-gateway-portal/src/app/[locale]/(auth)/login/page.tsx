'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import {
  Button,
  Input,
  Label,
  PasswordField,
  useToast,
} from '@myorg/shared/ui';
import { createFormResolver } from '@myorg/shared/ui-forms';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  useAuthLoginMutation,
  useBrandQuery,
} from '@myorg/modules/kissen-gateway/data-access';
import { LoginIllustration } from '@/components/brand/login-illustration';

// feature 库在本 app 内为 lazy-loaded（module-page-registry 动态导入），
// 边界规则禁止静态导入 —— 首登改密弹窗仅在登录成功后渲染，走动态分片。
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/kissen-gateway/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

/**
 * Kissen 银行门户登录页 — /[locale]/login（源 `views/login/index.vue`）。
 *
 * 流程与源一致：
 *  1. 登录前拉公开品牌接口 GET /bankgw/brand（失败回退默认值），
 *     品牌名 / logo / 副标题渲染在插画分屏布局上。
 *  2. POST /login {loginName,password} → LoginRespVO。
 *     会话落 localStorage（bankgw.token/bankgw.user，含 firstLogin、menuKeys、
 *     loginName 等全字段）+ middleware 读取的 cookie kissen_gateway_token；
 *     同时写入共享 AuthProvider（Header 用户名展示）。
 *  3. firstLogin === 0 → 强制改密弹窗（forced，不可关闭）；成功后的 toast
 *     与 /system/user 跳转由弹窗内部完成（源 change-pwd-dialog.vue）。
 *  4. URL 带 expired=1（401 拦截器跳回）→ toast「Session expired, please
 *     sign in again」（约束 2 裁定：全局统一 sonner toast，不用 alert 形态）。
 *
 * 保留原 MockLoginPage 的分屏插画布局风格（左侧渐变 + 插画，右侧表单），
 * 品牌与文案改为接口驱动 + 源中文文案。
 */
const loginSchema = z.object({
  loginName: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

interface LoginFormValues {
  loginName: string;
  password: string;
}

export default function LoginRoute() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const loginMutation = useAuthLoginMutation();
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);
  const [pwdVisible, setPwdVisible] = React.useState(false);

  // 源 login/index.vue：route.query.expired === '1' → 失效提示；redirect 兜底。
  const [searchParams, setSearchParams] =
    React.useState<URLSearchParams | null>(null);
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);
  const expired = searchParams?.get('expired') === '1';
  // redirect 回跳（兜底 /overview）。middleware 携带的 redirect 是含
  // locale 前缀的完整路径，而 i18n router 会自动补当前 locale —— 先剥掉
  // 前缀，避免落成 /en-US/en-US/... 双前缀。
  // 兜底与源 login/index.vue:60 的 '/onboard'（cb22c7a 遗留，v2.0 根路由
  // 已改 /overview）有意 diverge：已入网银行登录后应落 dashboard，未入网
  // 由 SessionGuard locked 拉回 /onboard（2026-09-02 用户裁决）。
  const redirectTarget =
    (searchParams?.get('redirect') || '/overview').replace(
      /^\/en-US(?=\/|$)/,
      '',
    ) || '/';

  // 源 login/index.vue：route.query.expired === '1' → 失效提示（toast）。
  React.useEffect(() => {
    if (expired) toast.warning('Session expired, please sign in again');
  }, [expired, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: createFormResolver(loginSchema),
    // Dev-only credential prefill (internal bank portal test account).
    // 取值来自 NEXT_PUBLIC_DEV_LOGIN_NAME / NEXT_PUBLIC_DEV_LOGIN_PASSWORD
    // （.env.local，模板见 .env.local.example）——未设置或为空则不预填；
    // 生产构建由下方 NODE_ENV 门控保证空字段。
    defaultValues:
      process.env.NODE_ENV === 'development'
        ? {
            loginName: process.env.NEXT_PUBLIC_DEV_LOGIN_NAME ?? '',
            password: process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? '',
          }
        : { loginName: '', password: '' },
  });
  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: (resp) => {
        // mutation onSuccess 已落网关会话（localStorage + cookie）；
        login(
          {
            id: String(resp.userId),
            // 源 MainLayout L57-59：头部展示 userName || loginName（userName 空时兜底）。
            name: resp.userName || resp.loginName,
            email: '',
            roles: [],
            permissions: resp.menuKeys,
            loginName: resp.loginName,
            userType: resp.userType,
            firstLogin: resp.firstLogin,
          },
          resp.token,
        );

        toast.success('Signed in successfully');

        // 源 login/index.vue：firstLogin（===0）→ 留在本页弹强制改密框。
        if (resp.firstLogin === 0) {
          setPwdVisible(true);
          return;
        }
        router.replace(redirectTarget);
      },
      onError: (e) => {
        // 源依赖拦截器 ElMessage；目标拦截器只抛 KissenApiError，这里统一提示。
        toast.error((e as Error).message || 'Sign-in failed');
      },
    });
  });

  return (
    <>
      <div className="grid min-h-screen bg-[#f4f8f7] lg:grid-cols-[minmax(430px,0.92fr)_minmax(560px,1.08fr)]">
        {/* Brand panel intentionally keeps the illustration outside the card flow so
            the visual identity remains stable while the form grows or shows errors. */}
        <section className="relative hidden min-h-screen overflow-hidden bg-[var(--brand-deep,#0B1F3A)] lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_srgb,var(--brand-accent,#2DD4BF)_30%,transparent),transparent_34%),linear-gradient(145deg,var(--login-grad-c,#0B5670)_0%,var(--brand-deep,#0B1F3A)_62%)]" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div className="relative z-10 flex h-full w-full flex-1 flex-col px-8 py-8 sm:px-12 lg:px-14 xl:px-20">
            <div
              className="flex items-center justify-between"
              aria-label={`${brand.name} Gateway`}
            >
              <div className="flex items-center gap-3">
                <GatewayMark className="h-10 w-10 shrink-0" />
                <div>
                  <p className="text-base font-semibold tracking-tight text-white">
                    {brand.name}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                    Gateway console
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/75 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent,#2DD4BF)] shadow-[0_0_10px_var(--brand-accent,#2DD4BF)]" />
                Secure access
              </div>
            </div>

            <div className="mt-12 max-w-[440px]">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-accent,#2DD4BF)]">
                Cross-bank infrastructure
              </p>
              <h2 className="max-w-[460px] text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white xl:text-5xl">
                {brand.subtitle}
              </h2>
              <p className="mt-5 max-w-[380px] text-sm leading-6 text-white/60">
                One secure control center for settlement, liquidity and digital
                currency operations.
              </p>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 items-end justify-center">
              <LoginIllustration className="h-auto max-h-[46vh] w-full max-w-[670px] object-contain select-none" />
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/45">
              <span>Bank-grade access control</span>
              <span>v2.0 · Portal</span>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-10 lg:px-14 xl:px-20">
          <div className="absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[var(--brand-accent,#2DD4BF)]/10 blur-3xl" />
          <div className="relative w-full max-w-[460px] rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-36px_rgba(11,31,58,0.28)] sm:p-10">
            <div className="mb-9 flex items-start justify-between gap-5">
              <div>
                <div className="mb-6 flex items-center gap-3 lg:hidden">
                  <GatewayMark className="h-9 w-9" />
                  <span className="text-sm font-semibold text-slate-900">
                    {brand.name}
                  </span>
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Welcome back
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[34px]">
                  Sign in to continue
                </h1>
                <p className="mt-3 max-w-[300px] text-sm leading-6 text-slate-500">
                  Access your bank gateway workspace securely.
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-deep,#0B1F3A)] text-white shadow-lg shadow-slate-900/10 sm:flex">
                <ShieldCheck
                  className="h-6 w-6 text-[var(--brand-accent,#2DD4BF)]"
                  aria-hidden="true"
                />
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2.5">
                <Label
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  htmlFor="loginName"
                >
                  Username
                </Label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="loginName"
                    placeholder="Enter your username"
                    autoComplete="username"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50/60 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2"
                    aria-invalid={!!errors.loginName}
                    aria-describedby={
                      errors.loginName ? 'loginName-error' : undefined
                    }
                    {...register('loginName')}
                  />
                </div>
                {errors.loginName && (
                  <p
                    id="loginName-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.loginName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  htmlFor="password"
                >
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <PasswordField
                    id="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50/60 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2"
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? 'password-error' : undefined
                    }
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="mt-2 h-12 w-full rounded-xl bg-[var(--brand-deep,#0B1F3A)] text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--login-grad-c,#0B5670)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
                {!loginMutation.isPending && (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </form>

            <p className="mt-8 border-t border-slate-100 pt-5 text-center text-[11px] leading-5 text-slate-400">
              Cross-Bank Digital Currency Clearing{' '}
              <span className="px-1.5 text-slate-300">·</span> Bank Portal
            </p>
          </div>
        </section>
      </div>

      {/* 首登强制改密（源 login/index.vue `:force="true"`）。成功后的
          toast 与 /system/user 跳转由弹窗内部完成（源 change-pwd-dialog.vue
          onClose + router.push 硬编码，不跟随 redirect 参数）。 */}
      <ChangePasswordDialog
        open={pwdVisible}
        onOpenChange={setPwdVisible}
        forced
      />
    </>
  );
}

/** Compact bank mark used in both desktop and mobile brand lockups. */
function GatewayMark({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="var(--brand-accent,#2DD4BF)" />
      <path
        d="M10 27.5h20M12.5 27.5V18l7.5-5 7.5 5v9.5M9 18h22M16 27.5V21h8v6.5"
        stroke="var(--brand-deep,#0B1F3A)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 13v-2"
        stroke="var(--brand-deep,#0B1F3A)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
