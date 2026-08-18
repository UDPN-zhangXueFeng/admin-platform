'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import { Button, Input, Label, useToast } from '@myorg/shared/ui';
import { createFormResolver } from '@myorg/shared/ui-forms';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  useAuthLoginMutation,
  useBrandQuery,
} from '@myorg/modules/kissen-gateway/data-access';

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
 *  3. firstLogin === 0 → 强制改密弹窗（forced，不可关闭），成功后跳
 *     /system/user（源 change-pwd-dialog.vue `router.push('/system/user')`）。
 *  4. URL 带 expired=1（401 拦截器跳回）→ 顶部「登录已失效，请重新登录」横幅。
 *
 * 保留原 MockLoginPage 的分屏插画布局风格（左侧渐变 + 插画，右侧表单），
 * 品牌与文案改为接口驱动 + 源中文文案。
 */
const loginSchema = z.object({
  loginName: z.string().min(1, '请输入登录名'),
  password: z.string().min(1, '请输入密码'),
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
  const redirectTarget = searchParams?.get('redirect') || '/onboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: createFormResolver(loginSchema),
    defaultValues: { loginName: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: (resp) => {
        // mutation onSuccess 已落网关会话（localStorage + cookie）；
        // 此处补共享 AuthProvider 快照供 Header 展示用户名/权限。
        login(
          {
            id: String(resp.userId),
            name: resp.userName,
            email: '',
            roles: [],
            permissions: resp.menuKeys,
            loginName: resp.loginName,
            userType: resp.userType,
            firstLogin: resp.firstLogin,
          },
          resp.token,
        );

        toast.success('登录成功');

        // 源 login/index.vue：firstLogin（===0）→ 留在本页弹强制改密框。
        if (resp.firstLogin === 0) {
          setPwdVisible(true);
          return;
        }
        router.replace(redirectTarget);
      },
      onError: (e) => {
        // 源依赖拦截器 ElMessage；目标拦截器只抛 KissenApiError，这里统一提示。
        toast.error((e as Error).message || '登录失败');
      },
    });
  });

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

      <div className="grid min-h-screen bg-white lg:grid-cols-2">
        {/* ── 左：品牌渐变插画分屏（保留原布局风格）────────────────────── */}
        <section
          className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8] lg:flex lg:flex-col lg:items-center lg:justify-center"
        >
          <div className="relative z-10 flex h-full w-full max-w-[760px] flex-col px-16 py-12 xl:px-24">
            <div className="mt-auto">
              <div
                className="flex items-end justify-center"
                aria-label={`${brand.name} Gateway`}
              >
                <span className="text-6xl font-black italic leading-none tracking-[-0.11em] text-[#001a98]">
                  {brand.name.charAt(0)}
                  <span className="text-[#00a5d5]">
                    {brand.name.slice(1)}
                  </span>
                </span>
                <span className="mb-1 ml-3 rounded-sm bg-[#00a5d5] px-2 py-0.5 text-base font-medium text-white">
                  Gateway
                </span>
              </div>
              <p className="mx-auto mt-10 max-w-[510px] text-2xl font-semibold leading-relaxed text-[#172260]">
                {brand.subtitle}
              </p>
            </div>

            <div className="mt-7 flex min-h-0 flex-1 items-center justify-center">
              <img
                src="/login-illustration.svg"
                alt=""
                width="720"
                height="560"
                className="h-auto max-h-[54vh] w-full max-w-[680px] select-none"
              />
            </div>
          </div>
        </section>

        {/* ── 右：登录表单（源 login/index.vue 卡片语义）────────────────── */}
        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[480px]">
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
                <Label htmlFor="loginName">登录名</Label>
                <Input
                  id="loginName"
                  placeholder="登录名"
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
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="密码"
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
                className="w-full"
                size="lg"
                disabled={loginMutation.isPending}
                style={{ backgroundColor: brand.primaryColor }}
              >
                {loginMutation.isPending ? '登录中…' : '登 录'}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-500">
              跨行数字货币清算 · 银行门户
            </p>
          </div>
        </section>
      </div>

      {/* 首登强制改密（源 login/index.vue `:force="true"`），成功后跳
          /system/user（源 change-pwd-dialog.vue，不跟随 redirect 参数） */}
      <ChangePasswordDialog
        open={pwdVisible}
        onOpenChange={setPwdVisible}
        forced
        onForcedDone={() => router.replace('/system/user')}
      />
    </>
  );
}
