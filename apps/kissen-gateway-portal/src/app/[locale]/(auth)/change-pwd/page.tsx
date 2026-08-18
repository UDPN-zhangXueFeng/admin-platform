'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Input, Label, useToast } from '@myorg/shared/ui';
import { createFormResolver } from '@myorg/shared/ui-forms';
import { useAuthChangePwdMutation } from '@myorg/modules/kissen-gateway/data-access';

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
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z
      .string()
      .min(1, '请输入新密码')
      .regex(PASSWORD_PATTERN, '至少 8 位,含字母与数字'),
    confirm: z.string(),
  })
  .refine((values) => values.confirm === values.newPassword, {
    path: ['confirm'],
    message: '两次输入不一致',
  });

type ChangePwdFormValues = z.infer<typeof changePwdSchema>;

export default function ChangePwdRoute() {
  const router = useRouter();
  const toast = useToast();
  const mutation = useAuthChangePwdMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePwdFormValues>({
    resolver: createFormResolver(changePwdSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('密码修改成功');
          router.replace('/system/user');
        },
        onError: (e) => {
          // 源依赖拦截器 ElMessage；目标拦截器只抛 KissenApiError，这里统一提示。
          toast.error((e as Error).message);
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
          <h1 className="text-xl font-bold text-foreground">Kissen 银行门户</h1>
          <p className="mt-1 text-xs tracking-[0.08em] text-muted-foreground">
            首次登录,请先修改密码
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gw-page-oldPassword">原密码</Label>
            <Input
              id="gw-page-oldPassword"
              type="password"
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
            <Label htmlFor="gw-page-newPassword">新密码</Label>
            <Input
              id="gw-page-newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位,含字母与数字"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gw-page-confirm">确认新密码</Label>
            <Input
              id="gw-page-confirm"
              type="password"
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
            {mutation.isPending ? '提交中…' : '确认修改'}
          </Button>
        </form>
      </div>
    </div>
  );
}
