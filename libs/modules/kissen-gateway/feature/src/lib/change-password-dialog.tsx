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

import { useAuthChangePwdMutation } from '@myorg/modules/kissen-gateway/data-access';

/**
 * 自助修改密码弹窗（源 `views/login/change-pwd-dialog.vue`）。
 *
 * 两种模式（与源 `:force` prop 一致）：
 * - forced=false：从顶栏菜单进入的自助改密，可取消、可关闭。
 * - forced=true：首次登录强制改密（源 login 页 `:force="true"`），
 *   隐藏取消按钮、禁止 ESC / 遮罩 / 右上角关闭；成功后调用 onForcedDone。
 *
 * 调用 `authChangePwd({ oldPassword, newPassword })` → POST `/change-pwd`；
 * 成功后 mutation 副作用已把本地会话 firstLogin 置 1（源 store.changePwd）。
 *
 * 校验与源 rules 完全对齐：
 * - 三字段必填（「请输入原密码」「请输入新密码」「请确认新密码」）
 * - 新密码：`/^(?=.*[A-Za-z])(?=.*\d).{8,}$/`（至少 8 位,含字母与数字）
 * - 确认密码与新密码一致（「两次输入不一致」）
 */
export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 首次登录强制改密模式（源 `:force`，不可关闭）。 */
  forced?: boolean;
  /** forced 模式下改密成功后的回调（源：onClose + router.push）。 */
  onForcedDone?: () => void;
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
  onForcedDone,
}: ChangePasswordDialogProps) {
  const toast = useToast();
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
          toast.success('密码修改成功');
          onOpenChange(false);
          if (forced) onForcedDone?.();
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
      >
        <DialogHeader>
          <DialogTitle>{forced ? '首次登录,请修改密码' : '修改密码'}</DialogTitle>
          <DialogDescription>请输入原密码与新密码</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gw-oldPassword">原密码</Label>
            <Input
              id="gw-oldPassword"
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
            <Label htmlFor="gw-newPassword">新密码</Label>
            <Input
              id="gw-newPassword"
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
            <Label htmlFor="gw-confirm">确认新密码</Label>
            <Input
              id="gw-confirm"
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
            {!forced && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
