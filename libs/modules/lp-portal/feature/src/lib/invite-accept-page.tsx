'use client';

/**
 * 管理员邀请落地页（源 `views/invite/accept.vue` 1:1，v2.1 a522963；
 * d90d91a 修确认密码校验——比较对象须为响应式 password 值）。
 *
 * Menu key: 无（免登录落地页，非菜单页） Path: /invite/accept
 *
 * 状态机 loading → ready | error；submit 成功 → done。鉴权靠邮件链接
 * ?token= 一次性 invite token（accept 成功即消费，再用报 MSG_23_0031）。
 * URL 无 token 参数时不发请求，直接按 MSG_23_0029 错误态（源 load() 同款）。
 *
 * 错误呈现双通道保真（§E38）：lp-client 拦截器已全局 toast，页面仍按
 * code 映射内联 error alert（标题 23_0029/30/31 三键，未知码兜底
 * Invalid invitation link；描述取后端 message，含 CJK 或空缺时回退
 * 联系运营文案——约束①用户可见文案零 CJK）。
 *
 * 校验与源 rules 逐条对应（zod 直译；RHF mode:'onTouched' 等价源
 * trigger:'blur'）：password 必填 + /^(?=.*[A-Za-z])(?=.*\d).{8,}$/；
 * confirm 必填 + 与 password 一致（refine 引用同一 values，天然规避
 * d90d91a 修的「比较对象写反恒失败」陷阱）。
 *
 * expireTime 使用门户统一时间格式。
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Building2,
  CircleCheck,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { z } from 'zod';
import { getLoginRedirectPath } from '@myorg/shared/util-auth';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import {
  inviteAccept,
  inviteVerify,
  type InviteInfo,
} from '@myorg/modules/lp-portal/data-access';
import { createFormResolver } from '@myorg/shared/ui-forms';
import { Button, Label, PasswordField } from '@myorg/shared/ui';

/** 源 accept.vue rules.password.pattern（与 change-pwd 同款）。 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const inviteSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Please set a password')
      .regex(
        PASSWORD_PATTERN,
        'At least 8 characters with letters and numbers',
      ),
    confirm: z.string().min(1, 'Please re-enter the password'),
  })
  .refine((values) => values.confirm === values.password, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type InviteFormValues = z.infer<typeof inviteSchema>;

/** 页面状态机（源 State 字面量类型）。 */
type InviteState = 'loading' | 'ready' | 'error' | 'done';

/** 邀请错误码 → 内联 alert 标题（源 ERROR_TITLES）。 */
const ERROR_TITLES: Record<string, string> = {
  MSG_23_0029: 'Invalid invitation link',
  MSG_23_0030: 'Invitation link expired',
  MSG_23_0031: 'Invitation link already used',
};

/** 描述兜底（源 errorDesc 空值回退；亦用于后端 message 含 CJK 时）。 */
const CONTACT_OPS = 'Please contact Kissen operations to resend the invitation';

/** 邀请过期时间统一使用门户格式，空/0 显 '-'。 */
function formatExpire(ms: number | undefined): string {
  if (!ms) return '-';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '-' : formatAdminDateTime(d);
}

export function InviteAcceptPage() {
  const [state, setState] = useState<InviteState>('loading');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState('');

  /** 源 showInviteError：code 映射标题；描述取后端 message，空/含 CJK 回退。 */
  function showInviteError(err: { code?: string; message?: string }) {
    setState('error');
    setErrorTitle(ERROR_TITLES[err.code ?? ''] ?? 'Invalid invitation link');
    const msg = err.message ?? '';
    setErrorDesc(msg && !/[\u4e00-\u9fff]/.test(msg) ? msg : CONTACT_OPS);
  }

  // 源 onMounted load()：无 token 直接错误态不发请求；verify 失败进 error。
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(t);
    if (!t) {
      showInviteError({ code: 'MSG_23_0029' });
      return;
    }
    inviteVerify({ token: t })
      .then((data) => {
        setInfo(data);
        setState('ready');
      })
      .catch((err: { code?: string; message?: string }) =>
        showInviteError(err),
      );
    // mount-only：源 onMounted 一次性验证，不随 state 重跑。
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: createFormResolver(inviteSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setSubmitting(true);
    inviteAccept({ token, password: values.password })
      .then(() => setState('done'))
      // accept 失败同 verify：拦截器已 toast，页面进 error 态（源同款）。
      .catch((err: { code?: string; message?: string }) => {
        setSubmitting(false);
        showInviteError(err);
      });
  });

  /** 源 goLogin：整页跳登录（保 locale 前缀，同 change-pwd 收口模式）。 */
  function goLogin() {
    window.location.assign(getLoginRedirectPath());
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--brand-deep,#0B1F3A)]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 8% 0%, var(--illus-mid, #2AA6B0) 0%, transparent 42%), radial-gradient(ellipse at 86% 100%, var(--brand-accent, #2DD4BF) 0%, transparent 34%), linear-gradient(135deg, var(--brand-deep, #0B1F3A) 0%, var(--illus-deep, #103F63) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:52px_52px]"
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col px-5 py-4 sm:px-8 sm:py-6 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[var(--brand-accent,#2DD4BF)]"
              aria-hidden="true"
            >
              <ShieldCheck className="h-5 w-5" />
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
            Authorized partner access
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(400px,0.8fr)] lg:gap-16 xl:gap-24">
          <section className="hidden min-w-0 max-w-[720px] lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent,#2DD4BF)]">
              Kissen Banking Network
            </p>
            <h2 className="mt-5 max-w-[680px] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white xl:text-6xl">
              Your LP Portal access starts here.
            </h2>
            <p className="mt-6 max-w-[540px] text-sm leading-7 text-white/65 sm:text-base">
              Use your invitation to create a password and activate your
              workspace. Your secure partner tools are one step away.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 text-xs text-white/70">
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Single-use invitation
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Secure password setup
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">
                Partner-only access
              </span>
            </div>

            <div className="relative mt-8 h-[min(30vh,250px)] w-full max-w-[680px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_60px_rgba(0,16,30,0.16)]">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px]"
              />
              <div className="absolute left-[14%] right-[14%] top-1/2 h-px bg-[var(--brand-accent,#2DD4BF)]/40" />
              <div className="relative mx-auto flex h-full max-w-[440px] flex-col justify-center rounded-2xl border border-white/20 bg-[var(--illus-deep,#103F63)]/65 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur-sm">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-accent,#2DD4BF)]/15 text-[var(--brand-accent,#2DD4BF)]">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Invitation workflow
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      Secure access, step by step
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 text-[10px] font-medium text-white/75 sm:text-[11px]">
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent,#2DD4BF)]/20 text-[var(--brand-accent,#2DD4BF)]">
                      01
                    </span>
                    Invitation
                  </span>
                  <span
                    className="h-px flex-1 bg-white/20"
                    aria-hidden="true"
                  />
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20">
                      02
                    </span>
                    Password
                  </span>
                  <span
                    className="h-px flex-1 bg-white/20"
                    aria-hidden="true"
                  />
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20">
                      03
                    </span>
                    Sign in
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="w-full min-w-0 max-w-[500px] self-center sm:justify-self-center lg:justify-self-end">
            <div className="min-w-0 rounded-[24px] border border-white/20 bg-white/[0.97] p-5 shadow-[0_28px_80px_rgba(0,16,30,0.3)] backdrop-blur sm:rounded-[28px] sm:p-8">
              <div className="mb-6">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-deep,#0B1F3A)]/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep,#0B1F3A)]">
                  <ShieldCheck
                    className="h-3.5 w-3.5 text-[var(--brand-accent,#2DD4BF)]"
                    aria-hidden="true"
                  />
                  Administrator invitation
                </div>
                <h1 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                  {state === 'loading'
                    ? 'Checking your invitation'
                    : state === 'error'
                      ? 'Invitation link unavailable'
                      : state === 'done'
                        ? 'Password set successfully'
                        : 'Create your password'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {state === 'loading'
                    ? 'We are checking that this secure link is still valid.'
                    : state === 'error'
                      ? 'This one-time link could not be verified. Contact your administrator for a new invitation.'
                      : state === 'done'
                        ? 'Your LP Portal access is ready. Sign in with your invited account to continue.'
                        : 'Choose a password for your invited LP Portal account.'}
                </p>
              </div>

              {state === 'loading' && (
                <div
                  className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-9 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-deep,#0B1F3A)]/[0.06] text-[var(--brand-deep,#0B1F3A)]">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Verifying invitation
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    This usually takes just a moment.
                  </p>
                </div>
              )}

              {state === 'error' && (
                <div className="space-y-4">
                  <div
                    className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                    role="alert"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-rose-900">
                        {errorTitle}
                      </p>
                      <p className="mt-1 break-words text-sm leading-5 text-rose-800/80">
                        {errorDesc}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full justify-between rounded-xl bg-[var(--brand-deep,#0B1F3A)] px-4 text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--illus-deep,#103F63)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] focus-visible:ring-offset-2"
                    onClick={goLogin}
                  >
                    <span>Go to Login</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {state === 'ready' && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--brand-deep,#0B1F3A)] shadow-sm">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Invited workspace
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                          {info?.lpName || info?.lpCode || 'LP Portal'}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 min-[440px]:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-[11px] text-slate-500">
                          Login account
                        </dt>
                        <dd className="mt-1 break-all text-sm font-medium text-slate-800">
                          {info?.loginName ?? '-'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[11px] text-slate-500">
                          Invitation expires
                        </dt>
                        <dd className="mt-1 break-words text-sm font-medium tabular-nums text-slate-800">
                          {formatExpire(info?.expireTime)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <form
                    onSubmit={onSubmit}
                    className="space-y-4"
                    noValidate
                    aria-busy={submitting}
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="invitePassword"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                      >
                        New Password
                        <span className="ml-0.5 text-rose-600" aria-hidden="true">
                          *
                        </span>
                      </Label>
                      <PasswordField
                        id="invitePassword"
                        placeholder="Create a password"
                        autoComplete="new-password"
                        required
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/70 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)]"
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={
                          errors.password
                            ? 'lp-invite-password-hint lp-invite-password-error'
                            : 'lp-invite-password-hint'
                        }
                        {...register('password')}
                      />
                      <p
                        id="lp-invite-password-hint"
                        className="text-xs leading-5 text-slate-500"
                      >
                        At least 8 characters, including letters and numbers.
                      </p>
                      {errors.password && (
                        <p
                          id="lp-invite-password-error"
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="inviteConfirm"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                      >
                        Confirm Password
                        <span className="ml-0.5 text-rose-600" aria-hidden="true">
                          *
                        </span>
                      </Label>
                      <PasswordField
                        id="inviteConfirm"
                        placeholder="Enter your password again"
                        autoComplete="new-password"
                        required
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/70 shadow-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)]"
                        aria-invalid={Boolean(errors.confirm)}
                        aria-describedby={
                          errors.confirm
                            ? 'lp-invite-confirm-hint lp-invite-confirm-error'
                            : 'lp-invite-confirm-hint'
                        }
                        {...register('confirm')}
                      />
                      <p
                        id="lp-invite-confirm-hint"
                        className="text-xs leading-5 text-slate-500"
                      >
                        Re-enter the same password to confirm.
                      </p>
                      {errors.confirm && (
                        <p
                          id="lp-invite-confirm-error"
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          {errors.confirm.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 w-full justify-between rounded-xl bg-[var(--brand-deep,#0B1F3A)] px-4 text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--illus-deep,#103F63)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] focus-visible:ring-offset-2"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span>Setting password…</span>
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        </>
                      ) : (
                        <>
                          <span>Set Password</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </form>

                  <p className="flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-500">
                    <KeyRound
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    This invitation link can only be used once.
                  </p>
                </div>
              )}

              {state === 'done' && (
                <div
                  className="space-y-5"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                      <CircleCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">
                        Account setup complete
                      </p>
                      <p className="mt-1 text-sm leading-5 text-emerald-900/75">
                        {info?.loginName
                          ? `Sign in as ${info.loginName} to continue to your LP workspace.`
                          : 'Sign in with your invited account to continue to your LP workspace.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full justify-between rounded-xl bg-[var(--brand-deep,#0B1F3A)] px-4 text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--illus-deep,#103F63)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#2DD4BF)] focus-visible:ring-offset-2"
                    onClick={goLogin}
                  >
                    <span>Go to Login</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-[11px] leading-5 text-white/50 sm:mt-5">
              Secure access for authorized LP partners
              <span className="px-2 text-white/25">·</span>
              Kissen Banking Network
            </p>
          </section>
        </div>

        <footer className="hidden items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/40 sm:flex">
          <span>Secure access for authorized partners</span>
          <span>LP Portal · Kissen</span>
        </footer>
      </div>
    </div>
  );
}
