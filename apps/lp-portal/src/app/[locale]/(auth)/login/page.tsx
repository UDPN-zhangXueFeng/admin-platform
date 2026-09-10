'use client';

import * as React from 'react';
import { ArrowRight, Building2, LockKeyhole, UserRound } from 'lucide-react';

import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import type { User } from '@myorg/shared/util-auth';
import {
  Button,
  Input,
  Label,
  PasswordField,
  useToast,
} from '@myorg/shared/ui';
import { LogoMark } from '@/components/brand/logo-mark';
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

  const [searchParams, setSearchParams] =
    React.useState<URLSearchParams | null>(null);
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
    <div className="relative h-[100dvh] min-h-0 overflow-hidden bg-[var(--brand-deep,#0B1F3A)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 8% 0%, var(--illus-mid, #2AA6B0) 0%, transparent 42%), radial-gradient(ellipse at 86% 100%, var(--brand-accent, #2DD4BF) 0%, transparent 34%), linear-gradient(135deg, var(--brand-deep, #0B1F3A) 0%, var(--illus-deep, #103F63) 100%)',
        }}
      />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:52px_52px]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col px-5 py-4 sm:px-8 sm:py-6 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between">
          <div
            className="flex items-center gap-3"
            aria-label="Kissen LP Portal"
          >
            <div className="flex h-11 w-[92px] items-center justify-center rounded-xl bg-white px-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
              <LogoMark className="h-auto w-full" />
            </div>
            <span className="h-8 w-px bg-white/20" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                LP Portal
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">
                Liquidity Provider Operations
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/75 sm:flex">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent,#2DD4BF)] shadow-[0_0_10px_var(--brand-accent,#2DD4BF)]"
              aria-hidden="true"
            />
            Institutional access
          </div>
        </header>

        <main className="grid min-h-0 min-w-0 flex-1 items-center gap-6 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)] lg:gap-16 xl:gap-24">
          <section className="hidden min-h-0 max-w-[720px] overflow-hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent,#2DD4BF)]">
              Kissen Banking Network
            </p>
            <h1 className="mt-5 max-w-[680px] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl xl:text-6xl">
              Banking infrastructure for liquidity operations.
            </h1>
            <p className="mt-6 max-w-[540px] text-sm leading-7 text-white/65 sm:text-base">
              A secure operating environment for institutional providers to
              manage liquidity, settlement readiness and digital asset flows.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 text-xs text-white/70">
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Bank-grade controls
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Institutional settlement
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Partner-only access
              </span>
            </div>

            <div className="relative mt-5 h-[min(30vh,250px)] w-full max-w-[680px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_60px_rgba(0,16,30,0.16)]">
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />
              <div className="absolute left-[14%] right-[14%] top-[48%] h-px bg-[var(--brand-accent,#2DD4BF)]/40" />
              <div className="absolute left-[24%] right-[24%] top-[32%] h-px bg-[var(--illus-accent,#F2C66D)]/40" />
              <div className="absolute left-[24%] right-[24%] top-[64%] h-px bg-[var(--illus-soft,#B9F3EA)]/30" />

              <div className="relative mx-auto flex h-full max-w-[390px] flex-col justify-center rounded-2xl border border-white/20 bg-[var(--illus-deep,#103F63)]/65 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Settlement ledger
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      Institutional liquidity
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--brand-accent,#2DD4BF)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand-accent,#2DD4BF)]" />
                    <span className="w-24 text-[11px] text-white/55">
                      Liquidity
                    </span>
                    <span className="h-1.5 flex-1 rounded-full bg-white/10">
                      <span className="block h-full w-4/5 rounded-full bg-[var(--brand-accent,#2DD4BF)] motion-safe:animate-pulse" />
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[var(--illus-accent,#F2C66D)]" />
                    <span className="w-24 text-[11px] text-white/55">
                      Settlement
                    </span>
                    <span className="h-1.5 flex-1 rounded-full bg-white/10">
                      <span className="block h-full w-3/5 rounded-full bg-[var(--illus-accent,#F2C66D)]" />
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[var(--illus-soft,#B9F3EA)]" />
                    <span className="w-24 text-[11px] text-white/55">
                      Controls
                    </span>
                    <span className="h-1.5 flex-1 rounded-full bg-white/10">
                      <span className="block h-full w-11/12 rounded-full bg-[var(--illus-soft,#B9F3EA)]" />
                    </span>
                  </div>
                </div>
              </div>

              <span className="absolute left-[12%] top-[43%] h-3 w-3 rounded-full border-2 border-[var(--brand-accent,#2DD4BF)] bg-[var(--brand-deep,#0B1F3A)] shadow-[0_0_16px_var(--brand-accent,#2DD4BF)]" />
              <span className="absolute right-[12%] top-[43%] h-3 w-3 rounded-full border-2 border-[var(--brand-accent,#2DD4BF)] bg-[var(--brand-deep,#0B1F3A)] shadow-[0_0_16px_var(--brand-accent,#2DD4BF)]" />
              <span className="absolute left-[22%] top-[27%] h-2.5 w-2.5 rounded-full bg-[var(--illus-accent,#F2C66D)] shadow-[0_0_14px_var(--illus-accent,#F2C66D)]" />
              <span className="absolute right-[22%] top-[59%] h-2.5 w-2.5 rounded-full bg-[var(--illus-soft,#B9F3EA)] shadow-[0_0_14px_var(--illus-soft,#B9F3EA)]" />
            </div>
          </section>

          <section className="w-[calc(100vw-2.5rem)] min-w-0 max-w-[440px] self-center sm:w-full lg:max-w-none lg:justify-self-end">
            <div className="min-w-0 rounded-[24px] border border-white/20 bg-white/[0.96] p-5 shadow-[0_28px_80px_rgba(0,16,30,0.3)] backdrop-blur sm:rounded-[28px] sm:p-8">
              {expiredNotice && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900"
                >
                  {expiredNotice}
                </div>
              )}

              <h1 className="sr-only">Sign in to LP Portal</h1>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void handleSubmit({
                    lpCode: String(data.get('lpCode') ?? ''),
                    loginName: String(data.get('username') ?? ''),
                    password: String(data.get('password') ?? ''),
                  });
                }}
                className="space-y-3.5 sm:space-y-5"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="lpCode"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  >
                    LP Code
                  </Label>
                  <div className="relative">
                    <Building2
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--brand-deep,#0B1F3A)] opacity-50"
                      aria-hidden="true"
                    />
                    <Input
                      id="lpCode"
                      name="lpCode"
                      placeholder="Enter your LP code"
                      autoComplete="off"
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pl-10 uppercase shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] sm:h-12"
                      required
                    />
                  </div>
                  <p className="text-[11px] leading-4 text-slate-400 sm:text-xs sm:leading-5">
                    Case-insensitive — normalized to uppercase on submit.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  >
                    Username
                  </Label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--brand-deep,#0B1F3A)] opacity-50"
                      aria-hidden="true"
                    />
                    <Input
                      id="username"
                      name="username"
                      placeholder="Enter your username"
                      autoComplete="username"
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] sm:h-12"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--brand-deep,#0B1F3A)] opacity-50"
                      aria-hidden="true"
                    />
                    <PasswordField
                      id="password"
                      name="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] sm:h-12"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="mt-1 h-11 w-full rounded-xl bg-[var(--brand-deep,#0B1F3A)] text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--illus-deep,#103F63)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] focus-visible:ring-offset-2 sm:mt-2 sm:h-12"
                  size="lg"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
                  {!loginMutation.isPending && (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </form>
            </div>
            <p className="mt-4 text-center text-[11px] leading-5 text-white/45 sm:mt-5">
              Authorized LP partners only
              <span className="px-2 text-white/25">·</span>
              Kissen Banking Network
            </p>
          </section>
        </main>

        <footer className="hidden items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/40 sm:flex">
          <span>Secure access for authorized partners</span>
          <span>LP Portal · Kissen</span>
        </footer>
      </div>
    </div>
  );
}
