'use client';

/**
 * 首次登录强制改密页（源 `views/login/change-pwd.vue` 1:1，A4；G1 对照改造）。
 *
 * 独立全屏卡片（(auth) 路由组，AppShell 之外）：首登用户唯一出路是改密成功，
 * mutation onSuccess 已把本地 firstLogin 置 1（源 store.changePwd 回写语义）。
 *
 * 改造点（偏离源 `router.push('/')`）：成功后 toast 英文提示 → 清本地会话
 * （clearLpSession，localStorage + middleware cookie 一并失效）→ 按 locale
 * 前缀回登录页，与 lp-client 会话失效链路同款（getLoginRedirectPath 从当前
 * 路径解析 /en-US|/zh-CN），页面层不自造重定向逻辑。
 *
 * 校验与源 rules 逐条对应（zod schema 直译英文文案；RHF mode:'onTouched'
 * 失焦首次校验 + 提交全量校验，等价源 trigger:'blur' 双时机）：
 * - 原密码必填「请输入原密码」→ 'Please enter your current password'
 * - 新密码必填 + /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
 *   「至少 8 位,含字母与数字」→ 'At least 8 characters with letters and numbers'
 * - 确认新密码仅校验与新密码一致（源无必填规则，空串即不一致提示）
 *   「两次输入不一致」→ 'Passwords do not match'
 *
 * 业务失败由 lp-client 拦截器统一 toast（message + traceId），表单层静默。
 */
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getLoginRedirectPath } from '@myorg/shared/util-auth';
import {
  LP_PROJECT_ID,
  clearLpSession,
  useAuthChangePwdMutation,
} from '@myorg/modules/lp-portal/data-access';
import { createFormResolver } from '@myorg/shared/ui-forms';
import { Button, Label, PasswordField, useToast } from '@myorg/shared/ui';

/** 源 change-pwd.vue rules.newPassword.pattern。 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const changePwdSchema = z
  .object({
    oldPassword: z.string().min(1, 'Please enter your current password'),
    newPassword: z
      .string()
      .min(1, 'Please enter a new password')
      .regex(
        PASSWORD_PATTERN,
        'At least 8 characters with letters and numbers',
      ),
    confirm: z.string(),
  })
  .refine((values) => values.confirm === values.newPassword, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type ChangePwdFormValues = z.infer<typeof changePwdSchema>;

export function ChangePwdPage() {
  const toast = useToast();
  const changePwdMutation = useAuthChangePwdMutation(LP_PROJECT_ID);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePwdFormValues>({
    resolver: createFormResolver(changePwdSchema),
    // 失焦首次校验、提交全量校验（与 kissen-gateway feature 弹窗同惯例）。
    mode: 'onTouched',
    defaultValues: { oldPassword: '', newPassword: '', confirm: '' },
  });

  const pending = changePwdMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    changePwdMutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success(
            'Password updated. Please log in with the new password.',
          );
          // 与 lp-client 会话失效分支同款：先清会话再整页跳登录（hard nav
          // 顺带清空 react-query 内存态，无需额外 invalidate）。
          clearLpSession();
          if (typeof window !== 'undefined') {
            window.location.assign(getLoginRedirectPath());
          }
        },
        onError: () => {
          // lp-client 拦截器已 toast，表单层静默（源 axios 拦截器语义）。
        },
      },
    );
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(900px_480px_at_50%_-10%,#EBF4F1_0%,#F7F7F5_60%)] px-4 py-10">
      {/* 源 .change-pwd-card：420px 卡片 */}
      <div className="w-full max-w-[420px] rounded-[10px] border bg-card p-9 pb-7 shadow-[0_8px_24px_rgba(26,29,33,0.08)]">
        {/* 源 login-brand：标题 + eyebrow 副标题「首次登录,请先修改密码」 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Kissen LP Portal
          </h1>
          <p className="mt-1 text-xs tracking-[0.08em] text-muted-foreground">
            First login: please change your password first
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="oldPassword">Current Password</Label>
            <PasswordField
              id="oldPassword"
              autoComplete="current-password"
              {...register('oldPassword')}
            />
            {errors.oldPassword && (
              <p className="text-sm text-destructive">
                {errors.oldPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <PasswordField
              id="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters with letters and numbers"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm New Password</Label>
            <PasswordField
              id="confirm"
              autoComplete="new-password"
              {...register('confirm')}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">{errors.confirm.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Submitting…' : 'Confirm Change'}
          </Button>
        </form>
      </div>
    </div>
  );
}
