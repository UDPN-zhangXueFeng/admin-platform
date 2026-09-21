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
import { CircleCheck, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { getLoginRedirectPath } from '@myorg/shared/util-auth';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import {
  inviteAccept,
  inviteVerify,
  type InviteInfo,
} from '@myorg/modules/lp-portal/data-access';
import { createFormResolver } from '@myorg/shared/ui-forms';
import { Alert, AlertDescription, AlertTitle, Button, PasswordField } from '@myorg/shared/ui';

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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(900px_480px_at_50%_-10%,#EBF4F1_0%,#F7F7F5_60%)] px-4 py-10">
      {/* 源 .invite-card：420px 卡片（与 login/change-pwd 同质感） */}
      <div className="w-full max-w-[420px] rounded-[10px] border bg-card p-9 pb-7 shadow-[0_8px_24px_rgba(26,29,33,0.08)]">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Kissen LP Portal
          </h1>
          <p className="mt-1 t-supporting uppercase tracking-widest text-muted-foreground">
            Administrator Invitation
          </p>
        </div>

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            <p>Verifying invitation link…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>{errorTitle}</AlertTitle>
              <AlertDescription>{errorDesc}</AlertDescription>
            </Alert>
            <Button type="button" className="w-full" onClick={goLogin}>
              Go to Login
            </Button>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div className="mb-4 space-y-1.5 rounded-md bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">
                You are invited as an administrator of LP{' '}
                &quot;{info?.lpName || info?.lpCode}&quot;
              </p>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Login account</span>
                <span className="font-mono text-xs tabular-nums">
                  {info?.loginName ?? '-'}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Valid until</span>
                <span className="font-mono text-xs tabular-nums">
                  {formatExpire(info?.expireTime)}
                </span>
              </div>
            </div>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <PasswordField
                  id="invitePassword"
                  placeholder="Set a password (min 8 characters, letters and numbers)"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'lp-invite-password-error' : undefined
                  }
                  {...register('password')}
                />
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
              <div className="space-y-1.5">
                <PasswordField
                  id="inviteConfirm"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm}
                  aria-describedby={
                    errors.confirm ? 'lp-invite-confirm-error' : undefined
                  }
                  {...register('confirm')}
                />
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
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Set Password'}
              </Button>
            </form>
          </>
        )}

        {state === 'done' && (
          <div className="flex flex-col items-center gap-2 py-8">
            <CircleCheck
              className="h-10 w-10 text-emerald-600"
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-foreground">
              Password set successfully
            </p>
            <p className="text-sm text-muted-foreground">
              Please sign in to the LP portal with your new password
            </p>
            <Button type="button" className="mt-4 w-full" onClick={goLogin}>
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
