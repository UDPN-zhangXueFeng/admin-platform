'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Label, PasswordField, useToast } from '@myorg/shared/ui';
import { createFormResolver } from '@myorg/shared/ui-forms';
import {
  clearGatewaySession,
  useAuthChangePwdMutation,
} from '@myorg/modules/kissen-gateway/data-access';
import { getLoginRedirectPath } from '@myorg/shared/util-auth';

/**
 * 首次登录强制改密页 — /[locale]/change-pwd（源 `views/login/change-pwd.vue`）。
 *
 * 独立整页表单（auth 组，无壳层侧栏，对应源挂在 MainLayout 之外的独立路由）。
 * 校验与源 rules 完全一致：
 * - 原密码必填（「请输入原密码」）
 * - 新密码必填 + `/^(?=.*[A-Za-z])(?=.*\d).{8,}$/`（至少 8 位,含字母与数字）
 * - 确认新密码与新密码一致（「两次输入不一致」）
 *
 * 成功后：mutation 副作用已把本地会话 firstLogin 置 1（源 store.changePwd），
 * 跳转 `/system/user`（源 `router.push('/system/user')`）。
 * 未登录访问本页由 middleware 拦截（/change-pwd 不在 PUBLIC_PATHS）。
 */

/** 源 change-pwd.vue rules.newPassword.pattern。 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const changePwdSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .regex(PASSWORD_PATTERN, 'At least 8 characters with letters and numbers'),
    confirm: z.string(),
  })
  .refine((values) => values.confirm === values.newPassword, {
    path: ['confirm'],
    message: 'Passwords do not match',
  })
  // 2026-11-10：不允许原样沿用当前密码（首登强制改密曾被复制三次通过）
  .refine((values) => values.newPassword !== values.oldPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

type ChangePwdFormValues = z.infer<typeof changePwdSchema>;

export default function ChangePwdRoute() {
  const router = useRouter();
  const toast = useToast();
  const mutation = useAuthChangePwdMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePwdFormValues>({
    resolver: createFormResolver(changePwdSchema),
    // 2026-11-11：与 LP/管理系统一致——失焦即校验、改字段即时复检（原先只在点确认时校验）
    mode: 'onTouched',
    defaultValues: { oldPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed successfully');
          router.replace('/system/user');
        },
        onError: (e) => {
          // 服务端「新密码与当前密码相同」回落到字段级提示（与前端校验同一处展示），
          // 其余错误仍走全局 toast（源依赖拦截器 ElMessage 的语义）。
          const message = (e as Error).message;
          if (/must be different from the current password/i.test(message)) {
            setError('newPassword', { type: 'server', message });
            return;
          }
          toast.error(message);
        },
      },
    );
  });

  return (
    // 源 .change-pwd-page：径向渐变底 + 居中 420px 卡片
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(900px_480px_at_50%_-10%,#EBF4F1_0%,#F7F7F5_60%)] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[10px] border bg-card p-9 pb-7 shadow-[0_8px_24px_rgba(26,29,33,0.08)]">
        {/* 源 login-brand：标题硬编码「Kissen 银行门户」+ eyebrow 副标题 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">UDPN Kissen Bank Gateway Management</h1>
          <p className="mt-1 text-xs tracking-[0.08em] text-muted-foreground">
            First login: change your password before continuing
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gw-page-oldPassword">Current Password</Label>
            <PasswordField
              id="gw-page-oldPassword"
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
            <Label htmlFor="gw-page-newPassword">New Password</Label>
            <PasswordField
              id="gw-page-newPassword"
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
            <Label htmlFor="gw-page-confirm">Confirm New Password</Label>
            <PasswordField
              id="gw-page-confirm"
              autoComplete="new-password"
              {...register('confirm')}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">
                {errors.confirm.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Confirm'}
          </Button>
          {/* 2026-11-11：强制改密由服务端 first_login 标记决定，清缓存绕不过；
              提供显式出口便于换账号（下次登录仍会被要求改密）。 */}
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              clearGatewaySession();
              window.location.assign(getLoginRedirectPath());
            }}
          >
            Sign in with another account
          </button>
        </form>
      </div>
    </div>
  );
}
