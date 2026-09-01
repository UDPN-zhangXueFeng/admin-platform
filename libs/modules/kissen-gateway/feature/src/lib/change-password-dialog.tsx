'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PasswordField,
  Label,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { useAuthChangePwdMutation } from '@myorg/modules/kissen-gateway/data-access';

/**
 * 自助修改密码弹窗（源 `views/login/change-pwd-dialog.vue`）。
 *
 * 两种模式（与源 `:force` prop 一致）：
 * - forced=false：从顶栏菜单进入的自助改密，可取消、可 ESC / 关闭 X。
 * - forced=true：首次登录强制改密（源 login 页 `:force="true"`），
 *   隐藏取消按钮、禁止 ESC / 右上角关闭，完全不可逃逸；遮罩点击在
 *   两种模式下均不关闭（源 `:close-on-click-modal="false"` 无条件生效）。
 *
 * 调用 `authChangePwd({ oldPassword, newPassword })` → POST `/change-pwd`；
 * 成功后 mutation 副作用已把本地会话 firstLogin 置 1（源 store.changePwd），
 * 随后 toast 成功提示并跳 `/system/user`（源 onClose + router.push 硬编码，
 * 两种模式行为一致，不跟随 redirect 参数）。
 *
 * 校验与独立改密页（change-pwd/page.tsx）完全一致：
 * - 原密码 / 新密码必填；新密码 `/^(?=.*[A-Za-z])(?=.*\d).{8,}$/`
 * - 确认密码与新密码一致（源 confirm validator，无单独必填规则）
 */
export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 首次登录强制改密模式（源 `:force`，不可关闭）。 */
  forced?: boolean;
}

interface ChangePwdFormValues {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}

/** 源 change-pwd-dialog.vue rules.newPassword.pattern。 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function ChangePasswordDialog({
  open,
  onOpenChange,
  forced = false,
}: ChangePasswordDialogProps) {
  const toast = useToast();
  const router = useRouter();
  const mutation = useAuthChangePwdMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ChangePwdFormValues>({
    defaultValues: { oldPassword: '', newPassword: '', confirm: '' },
  });

  // 打开时重置表单（源 watch modelValue → 清空三字段）。
  React.useEffect(() => {
    if (open) {
      reset({ oldPassword: '', newPassword: '', confirm: '' });
    }
  }, [open, reset]);

  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed successfully');
          onOpenChange(false);
          // 源 change-pwd-dialog.vue：onClose 后硬编码跳 /system/user（两种模式一致）。
          router.push('/system/user');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <Dialog
      open={open}
      // 源 `:close-on-press-escape="!force" :close-on-click-modal="false"`
      // —— forced 模式下不响应任何外部关闭。
      onOpenChange={forced ? undefined : onOpenChange}
    >
      <DialogContent
        className="sm:max-w-[420px]"
        showCloseButton={!forced}
        // 源 `:close-on-click-modal="false"`：遮罩点击永不关闭（两种模式）。
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{forced ? 'Change Password Required' : 'Change Password'}</DialogTitle>
          <DialogDescription>Enter your current and new password</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label
              htmlFor="gw-oldPassword"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Current Password
              <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
            </Label>
            <PasswordField
              id="gw-oldPassword"
              autoComplete="current-password"
              aria-invalid={!!errors.oldPassword}
              aria-describedby={
                errors.oldPassword ? 'gw-oldPassword-error' : undefined
              }
              {...register('oldPassword', {
                required: 'Current password is required',
              })}
            />
            {errors.oldPassword && (
              <p
                id="gw-oldPassword-error"
                className="mt-1 text-sm text-destructive"
                role="alert"
              >
                {errors.oldPassword.message}
              </p>
            )}
          </div>

          <div>
            <Label
              htmlFor="gw-newPassword"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              New Password
              <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
            </Label>
            <PasswordField
              id="gw-newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters with letters and numbers"
              aria-invalid={!!errors.newPassword}
              aria-describedby={
                errors.newPassword ? 'gw-newPassword-error' : undefined
              }
              {...register('newPassword', {
                required: 'New password is required',
                pattern: {
                  value: PASSWORD_PATTERN,
                  message: 'At least 8 characters with letters and numbers',
                },
              })}
            />
            {errors.newPassword && (
              <p
                id="gw-newPassword-error"
                className="mt-1 text-sm text-destructive"
                role="alert"
              >
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <Label
              htmlFor="gw-confirm"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Confirm New Password
              <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
            </Label>
            <PasswordField
              id="gw-confirm"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'gw-confirm-error' : undefined}
              {...register('confirm', {
                validate: (v) => v === newPassword || 'Passwords do not match',
              })}
            />
            {errors.confirm && (
              <p
                id="gw-confirm-error"
                className="mt-1 text-sm text-destructive"
                role="alert"
              >
                {errors.confirm.message}
              </p>
            )}
          </div>

          <DialogFooter>
            {!forced && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
