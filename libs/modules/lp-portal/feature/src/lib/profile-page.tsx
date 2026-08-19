'use client';

/**
 * 个人中心（源 `views/profile/index.vue` 1:1，A8）。
 *
 * 在 AppShell 内（(app) 路由组）：账号信息 + 修改密码两张卡片。会话读本地
 * 持久化的 LoginRespVO（源 profile 直读 store.userInfo；无服务端端点）。
 *
 * 改密用共享 useAuthChangePwdMutation（onSuccess 顺带 firstLogin 置 1——
 * 守卫保证本页仅 firstLogin!==0 可达，置 1 无语义偏差）。
 */
import * as React from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@myorg/shared/ui';
import {
  LP_PROJECT_ID,
  useAuthChangePwdMutation,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

import {
  EMPTY_PWD_FORM,
  validatePwdForm,
  type PwdFormState,
} from './pwd-validation';

export function ProfilePage() {
  const toast = useToast();
  const { data: session } = useLpSessionQuery(LP_PROJECT_ID);
  const changePwdMutation = useAuthChangePwdMutation(LP_PROJECT_ID);

  const [form, setForm] = React.useState<PwdFormState>(EMPTY_PWD_FORM);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof PwdFormState, string>>
  >({});

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
      toast.success('Password changed successfully');
      setForm(EMPTY_PWD_FORM);
      setErrors({});
    } catch {
      // lp-client 拦截器已 toast（message + traceId）。
    }
  };

  const pending = changePwdMutation.isPending;
  const info: Array<{ label: string; value: string }> = [
    { label: 'Login Name', value: session?.loginName || '-' },
    { label: 'Name', value: session?.userName || '-' },
    { label: 'LP ID', value: session?.lpId != null ? String(session.lpId) : '-' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {info.map((item) => (
              <div key={item.label} className="space-y-1">
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="max-w-sm space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="profile-oldPassword">Current Password</Label>
              <Input
                id="profile-oldPassword"
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
              <Label htmlFor="profile-newPassword">New Password</Label>
              <Input
                id="profile-newPassword"
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
              <Label htmlFor="profile-confirmPassword">Confirm New Password</Label>
              <Input
                id="profile-confirmPassword"
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

            <Button type="submit" disabled={pending}>
              {pending ? 'Submitting…' : 'Confirm Change'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
