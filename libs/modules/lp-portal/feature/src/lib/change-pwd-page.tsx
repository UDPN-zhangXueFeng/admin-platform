'use client';

/**
 * 首次登录强制改密页（源 `views/change-pwd/index.vue` 1:1，A4）。
 *
 * 独立全屏卡片（不在 AppShell 内，(auth) 路由组）：首登用户唯一出路是改密
 * 成功——mutation onSuccess 会把本地 firstLogin 置 1（源 store.changePwd 回写
 * 语义），随后跳 / 由 root 落点探测接管。
 *
 * 校验与源一致：原密码必填；新密码必填且 /^(?=.*[A-Za-z])(?=.*\d).{8,}$/；
 * 确认密码仅校验与新密码一致（源无必填规则，空串即不一致提示）。
 * 业务失败由 lp-client 拦截器统一 toast，表单层静默。
 */
import * as React from 'react';

import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, useToast } from '@myorg/shared/ui';
import {
  LP_PROJECT_ID,
  useAuthChangePwdMutation,
} from '@myorg/modules/lp-portal/data-access';

import {
  EMPTY_PWD_FORM,
  validatePwdForm,
  type PwdFormState,
} from './pwd-validation';

export function ChangePwdPage() {
  const router = useRouter();
  const toast = useToast();
  const changePwdMutation = useAuthChangePwdMutation(LP_PROJECT_ID);

  const [form, setForm] = React.useState<PwdFormState>(EMPTY_PWD_FORM);
  const [errors, setErrors] = React.useState<Partial<Record<keyof PwdFormState, string>>>({});

  const setField =
    (field: keyof PwdFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validatePwdForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await changePwdMutation.mutateAsync({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      toast.success('密码修改成功');
      // firstLogin 已被 mutation onSuccess 置 1 → 守卫放行，root 落点接管。
      router.replace('/');
    } catch {
      // lp-client 拦截器已 toast（message + traceId）。
    }
  };

  const pending = changePwdMutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Kissen LP 门户</CardTitle>
          <p className="text-sm text-muted-foreground">
            首次登录，请先修改密码
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="oldPassword">原密码</Label>
              <Input
                id="oldPassword"
                type="password"
                autoComplete="current-password"
                value={form.oldPassword}
                onChange={setField('oldPassword')}
              />
              {errors.oldPassword && (
                <p className="text-sm text-destructive">{errors.oldPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={setField('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? '提交中…' : '确认修改'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
