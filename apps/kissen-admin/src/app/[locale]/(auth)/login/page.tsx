'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  KeyRound,
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
      <div className="relative h-[100dvh] min-h-0 overflow-hidden bg-[hsl(var(--background))]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 90% 14%, color-mix(in srgb, var(--brand-accent, #2DD4BF) 13%, transparent), transparent 25%), linear-gradient(135deg, color-mix(in srgb, var(--brand-deep, #0B1F3A) 5%, white), white 42%, color-mix(in srgb, var(--brand-accent, #2DD4BF) 6%, white))',
          }}
        />
        <header className="relative h-16 border-b border-white/10 bg-[var(--brand-deep,#0B1F3A)]">
          <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
            <div className="flex items-center gap-3">
              <KissenHeaderMark />
              <span className="h-4 w-px bg-white/20" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-wide text-white/60">
                Admin Console
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 text-[11px] text-white/55 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent,#2DD4BF)]" />
                Secure workspace
              </span>
              <ThemeSwitcher themes={themes} />
            </div>
          </div>
        </header>

        <main className="relative mx-auto grid h-[calc(100dvh-4rem)] min-h-0 w-full max-w-[1440px] lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
          <section className="flex min-h-0 items-center px-5 py-6 sm:px-12 lg:border-r lg:border-[var(--brand-deep,#0B1F3A)]/10 lg:px-16 xl:px-20">
            <div className="w-full max-w-[380px]">
              <div className="mb-8">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep,#0B1F3A)]/60">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--brand-accent,#2DD4BF)_16%,white)]">
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-[var(--brand-deep,#0B1F3A)]"
                      aria-hidden="true"
                    />
                  </span>
                  Protected sign in
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  Sign in
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use your administrator credentials to continue.
                </p>
              </div>

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
                className="space-y-5"
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
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/70 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)]"
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
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/70 pl-10 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)]"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-[var(--brand-deep,#0B1F3A)] text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--illus-deep,#103F63)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] focus-visible:ring-offset-2"
                  size="lg"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
                  {!loginMutation.isPending && (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </form>

              <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-slate-500">
                <KeyRound className="h-3.5 w-3.5 text-[var(--brand-deep,#0B1F3A)]/55" aria-hidden="true" />
                Authorized administrators only
              </p>
            </div>
          </section>

          <section className="relative hidden min-h-0 overflow-hidden px-12 py-14 lg:flex lg:flex-col xl:px-20">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(color-mix(in_srgb,var(--brand-deep,#0B1F3A)_7%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--brand-deep,#0B1F3A)_7%,transparent)_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="relative flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-deep,#0B1F3A)]/55">
                Network operations
              </p>
              <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--brand-deep,#0B1F3A)]/65">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent,#2DD4BF)] shadow-[0_0_10px_var(--brand-accent,#2DD4BF)]" />
                All systems ready
              </span>
            </div>

            <div className="relative my-auto grid max-w-[620px] grid-cols-[1fr_auto_1fr] items-center gap-5">
              <div className="space-y-4">
                {['Identity', 'Permissions', 'Approvals'].map((label) => (
                  <div
                    className="border-b border-[var(--brand-deep,#0B1F3A)]/15 pb-3"
                    key={label}
                  >
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--brand-deep,#0B1F3A)]">
                      Verified access
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3" aria-hidden="true">
                <span className="h-10 w-px bg-[var(--brand-deep,#0B1F3A)]/20" />
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--brand-deep,#0B1F3A)]/20 bg-white shadow-[0_12px_30px_color-mix(in_srgb,var(--brand-deep,#0B1F3A)_12%,transparent)]">
                  <ShieldCheck className="h-5 w-5 text-[var(--brand-accent,#2DD4BF)]" />
                </span>
                <span className="h-10 w-px bg-[var(--brand-deep,#0B1F3A)]/20" />
              </div>

              <div className="border-l border-[var(--brand-deep,#0B1F3A)]/15 pl-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep,#0B1F3A)]/50">
                  Kissen Admin
                </p>
                <p className="mt-3 max-w-[180px] text-sm leading-6 text-slate-600">
                  Governed access for settlement, liquidity and operations.
                </p>
              </div>
            </div>

            <div className="relative flex items-center justify-between border-t border-[var(--brand-deep,#0B1F3A)]/10 pt-5 text-[11px] text-slate-500">
              <span>Role-based control</span>
              <span>Audit-ready workspace</span>
            </div>
          </section>
        </main>
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
