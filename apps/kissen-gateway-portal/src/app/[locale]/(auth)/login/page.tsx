'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import { Button, Input, Label, PasswordField, useToast } from '@myorg/shared/ui';
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
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(
    null,
  );
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);
  const expired = searchParams?.get('expired') === '1';
  // 源 login/index.vue：redirect 回跳（兜底 /onboard）。middleware 携带的
  // redirect 是含 locale 前缀的完整路径，而 i18n router 会自动补当前
  // locale —— 先剥掉前缀，避免落成 /en-US/en-US/... 双前缀。
  const redirectTarget =
    (searchParams?.get('redirect') || '/onboard').replace(
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

      <div className="grid min-h-screen bg-white lg:grid-cols-2">
        {/* ── 左：品牌渐变插画分屏（保留原布局风格）────────────────────── */}
        {/* R-5（04 §2）：徽标区固定面板顶部（不随视口高度下沉越过中线），
            插画按比例适配剩余高度（46vh 上限 + max-w-full 等比缩放），
            1280×800 下底部不被裁切；面板铺满、不设内容宽度上限（约束 3）。 */}
        <section
          className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--login-grad-a,#B7F0DC)] via-[var(--login-grad-b,#5FD3AC)] to-[var(--login-grad-c,#0B6B53)] lg:flex lg:flex-col"
        >
          <div className="relative z-10 flex h-full w-full flex-1 flex-col px-16 py-12 xl:px-24">
            <div
              className="flex items-end justify-center"
              aria-label={`${brand.name} Gateway`}
            >
              <span className="text-6xl font-black italic leading-none tracking-[-0.11em] text-[var(--brand-deep,#0B6B53)]">
                {brand.name.charAt(0)}
                <span className="text-white/80">
                  {brand.name.slice(1)}
                </span>
              </span>
              <span className="mb-1 ml-3 rounded-sm bg-[var(--brand-deep,#0B1F3A)] px-2 py-0.5 text-base font-medium text-white">
                Gateway
              </span>
            </div>
            <p className="mx-auto mt-10 text-2xl font-semibold leading-relaxed text-[var(--brand-deep,#0B1F3A)]">
              {brand.subtitle}
            </p>

            <div className="mt-7 flex min-h-0 flex-1 items-center justify-center">
              <LoginIllustration className="h-auto w-auto max-h-[46vh] max-w-full select-none" />
            </div>
          </div>
        </section>

        {/* ── 右：登录表单（源 login/index.vue 卡片语义）────────────────── */}
        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 flex flex-col items-center gap-3 text-center">
              {/* 源 login-brand：logo + 标题 + 副标题 */}
              <span className="text-5xl leading-none" aria-hidden="true">
                {brand.logo}
              </span>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#1a1d21] sm:text-4xl">
                {brand.name}
              </h1>
              <p className="text-sm text-muted-foreground">{brand.subtitle}</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="loginName">Username</Label>
                <Input
                  id="loginName"
                  placeholder="Username"
                  autoComplete="username"
                  {...register('loginName')}
                />
                {errors.loginName && (
                  <p className="text-sm text-destructive">
                    {errors.loginName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordField
                  id="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-500">
              Cross-Bank Digital Currency Clearing · Bank Portal
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
