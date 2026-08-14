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
  Input,
  Label,
  useToast,
} from '@myorg/shared/ui';

import { useUserChangePwdMutation } from '@myorg/modules/kissen-admin/data-access';

/**
 * 自助修改密码弹窗（源 `views/login/change-pwd.vue`）。
 *
 * 两种模式（与源一致）：
 * - force=false：从 Header 菜单进入的自助改密，可取消、可关闭。
 * - force=true：首次登录强制改密（源 login 页 `:force="true"`），
 *   隐藏取消按钮、禁止 ESC / 遮罩关闭；成功后调用 onForceDone 回调。
 *
 * 调用 `userChangePwd({ oldPassword, newPassword })` →
 * POST `/rbac/user/change-pwd`。
 *
 * 校验与源 rules 对齐：
 * - 三字段必填
 * - 新密码：`/^(?=.*[A-Za-z])(?=.*\d).{8,}$/`（至少 8 位，含字母与数字）
 * - 确认密码与新密码一致
 */
export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 首次登录强制改密模式（源 `:force="true"`）。 */
  force?: boolean;
  /** force 模式下改密成功后的回调（源：markFirstLoginDone + router.push('/')）。 */
  onForceDone?: () => void;
}

interface ChangePwdFormValues {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function ChangePasswordDialog({
  open,
  onOpenChange,
  force = false,
  onForceDone,
}: ChangePasswordDialogProps) {
  const toast = useToast();
  const mutation = useUserChangePwdMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ChangePwdFormValues>({
    defaultValues: { oldPassword: '', newPassword: '', confirm: '' },
  });

  // 弹窗关闭时重置表单（源 watch modelValue → reset）。
  React.useEffect(() => {
    if (!open) {
      reset({ oldPassword: '', newPassword: '', confirm: '' });
    }
  }, [open, reset]);

  const newPassword = watch('newPassword');

  const onClose = React.useCallback(() => {
    if (!force) onOpenChange(false);
  }, [force, onOpenChange]);

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('密码修改成功');
          onOpenChange(false);
          if (force) onForceDone?.();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={force ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-[420px]"
        // 源 `:close-on-click-modal="false" :close-on-press-escape="!force" :show-close="!force"`
        showCloseButton={!force}
      >
        <DialogHeader>
          <DialogTitle>{force ? '首次登录,请修改密码' : '修改密码'}</DialogTitle>
          <DialogDescription>请输入原密码与新密码</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oldPassword">原密码</Label>
            <Input
              id="oldPassword"
              type="password"
              autoComplete="current-password"
              {...register('oldPassword', {
                required: '请输入原密码',
              })}
            />
            {errors.oldPassword && (
              <p className="text-sm text-destructive">
                {errors.oldPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位,含字母与数字"
              {...register('newPassword', {
                required: '请输入新密码',
                pattern: {
                  value: PASSWORD_PATTERN,
                  message: '至少 8 位,含字母与数字',
                },
              })}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">确认新密码</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register('confirm', {
                required: '请确认新密码',
                validate: (v) => v === newPassword || '两次输入不一致',
              })}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">
                {errors.confirm.message}
              </p>
            )}
          </div>

          <DialogFooter>
            {!force && (
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '提交中…' : '确认修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
