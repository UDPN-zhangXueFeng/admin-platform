'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  Button,
  Input,
  Label,
  PasswordField,
  useToast,
} from '@myorg/shared/ui';
import { KissenHeaderMark } from '../../../../components/brand/kissen-brand-mark';
import { useAuth } from '@myorg/shared/util-auth';
import type { User } from '@myorg/shared/util-auth';
import { useTheme } from '@myorg/shared/util-config';
import { useUserLoginMutation } from '@myorg/modules/kissen-admin/data-access';

// feature 库在本 app 内为 lazy-loaded（module-page-registry 动态导入），
// 边界规则禁止静态导入 —— 首登改密弹窗仅在交互后渲染，走动态分片。
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/kissen-admin/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

const ThemeSwitcher = dynamic(
  () =>
    import('@myorg/modules/kissen-admin/feature').then(
      (m) => m.ThemeSwitcher,
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
 *  4. Else → redirect to `?redirect=` param or /workbench
 *     (源 login/index.vue:62-63 push(route.query.redirect || '/')；默认随 menuUrl)。
 */
export default function LoginRoute() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const { themes } = useTheme();
  const loginMutation = useUserLoginMutation();
  const [pwdVisible, setPwdVisible] = React.useState(false);

  // 源 login/index.vue:19-22 — 401 踢回登录页时展示「登录已失效」横幅。
  const [searchParams, setSearchParams] =
    React.useState<URLSearchParams | null>(null);
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);
  const expired = searchParams?.get('expired') === '1';
  // next-intl router auto-prefixes the locale — the middleware-written
  // redirect param carries the full pathname (incl. /en-US), so strip the
  // prefix or router.replace lands on /en-US/en-US/... (404 Module Not Found).
  const rawRedirect = searchParams?.get('redirect');
  const redirectTarget =
    rawRedirect?.replace(/^\/en-US(?=\/|$)/, '') || '/workbench';

  React.useEffect(() => {
    if (expired) toast.warning('Session expired, please sign in again');
  }, [expired, toast]);

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
            <div className="flex items-center gap-3" aria-label="Kissen Admin">
              <div className="flex h-11 items-center">
                <KissenHeaderMark />
              </div>
              <span className="h-8 w-px bg-white/20" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-white">
                  Admin Console
                </p>
                <p className="mt-0.5 text-[11px] text-white/55">
                  Network Management System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/75 sm:inline-flex">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent,#2DD4BF)] shadow-[0_0_10px_var(--brand-accent,#2DD4BF)]"
                  aria-hidden="true"
                />
                Administrative access
              </span>
              <ThemeSwitcher themes={themes} />
            </div>
          </header>

          <main className="grid min-h-0 min-w-0 flex-1 items-center gap-6 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)] lg:gap-16 xl:gap-24">
            <section className="hidden min-h-0 max-w-[720px] overflow-hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent,#2DD4BF)]">
                Kissen Banking Network
              </p>
              <h1 className="mt-5 max-w-[680px] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl xl:text-6xl">
                Administration infrastructure for liquidity operations.
              </h1>
              <p className="mt-6 max-w-[540px] text-sm leading-7 text-white/65 sm:text-base">
                A secure operating environment for teams managing settlement,
                liquidity governance and digital asset operations.
              </p>

              <div className="mt-7 flex flex-wrap gap-3 text-xs text-white/70">
                <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                  Role-based controls
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                  Liquidity governance
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                  Audit-ready workspace
                </span>
              </div>

              <div className="relative mt-5 h-[min(30vh,250px)] w-full max-w-[680px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_60px_rgba(0,16,30,0.16)]">
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />
                <div className="relative mx-auto flex h-full max-w-[390px] flex-col justify-center rounded-2xl border border-white/20 bg-[var(--illus-deep,#103F63)]/65 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur-sm">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <ShieldCheck
                      className="h-5 w-5 text-[var(--brand-accent,#2DD4BF)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                        Secure operations layer
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        Governed access for administration teams
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3" aria-hidden="true">
                    <span className="block h-1.5 w-4/5 rounded-full bg-[var(--brand-accent,#2DD4BF)]/70" />
                    <span className="block h-1.5 w-3/5 rounded-full bg-[var(--illus-accent,#F2C66D)]/60" />
                    <span className="block h-1.5 w-11/12 rounded-full bg-[var(--illus-soft,#B9F3EA)]/50" />
                  </div>
                </div>
              </div>
            </section>

            <section className="w-[calc(100vw-2.5rem)] min-w-0 max-w-[440px] self-center sm:w-full lg:max-w-none lg:justify-self-end">
              <div className="min-w-0 rounded-[24px] border border-white/20 bg-white/[0.96] p-5 shadow-[0_28px_80px_rgba(0,16,30,0.3)] backdrop-blur sm:rounded-[28px] sm:p-8">
                {expired && (
                  <div
                    role="alert"
                    className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900"
                  >
                    Your session has expired. Please sign in again.
                  </div>
                )}

                <div className="mb-6 lg:hidden">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-deep,#0B1F3A)]/55">
                    Admin Console
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
                    Sign in
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Use your administrator credentials to continue.
                  </p>
                </div>

                <h1 className="sr-only">Sign in to Kissen Admin</h1>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const data = new FormData(form);
                    void handleSubmit({
                      loginName: String(data.get('username') ?? ''),
                      password: String(data.get('password') ?? ''),
                    });
                  }}
                  className="space-y-3.5 sm:space-y-5"
                >
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
                Authorized administrators only
                <span className="px-2 text-white/25">·</span>
                Kissen Banking Network
              </p>
            </section>
          </main>

          <footer className="hidden items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/40 sm:flex">
            <span>Secure access for administration teams</span>
            <span>Admin Console · Kissen</span>
          </footer>
        </div>
      </div>
      <ChangePasswordDialog
        open={pwdVisible}
        onOpenChange={setPwdVisible}
        force
        onForceDone={() => router.replace(redirectTarget)}
      />
    </>
  );
}
