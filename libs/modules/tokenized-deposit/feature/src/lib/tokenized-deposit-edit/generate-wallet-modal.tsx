'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@myorg/shared/ui';

/**
 * GenerateWalletModal — keystore 路径钱包生成密码 Modal。
 *
 * 迁移自 td-manage `edit/GenerateWalletModal.tsx`（89 行）。
 *
 * ## 触发
 *
 * `useWalletManagement.checkWalletAddress(type)` 在 keystore 路径
 * （selectedKeyService.storageType === 'key_keystore'）且无已存在钱包时，
 * `setIsModalOpen(true)`；已有钱包则先经 `confirmOverwrite`（edit 页 AlertDialog）
 * 确认覆盖后再打开本 Modal。
 *
 * ## 提交
 *
 * react-hook-form 受控 password 字段（required），onSubmit → props.onSubmit
 * （即 useWalletManagement.setWalletInfo）：调 generateWalletKeystore（内部 AES
 * 加密 password）回填 walletAddress + keyStore + passWord 到主表单对应角色字段。
 * 成功后 hook 内部 form1.reset() + setIsModalOpen(false)。
 *
 * ## 与源差异
 *
 * - antd CustomModal + CustomForms → shared/ui Dialog + react-hook-form。
 * - antd FormInstance（外部 form1）→ 内部 useForm（密码表单自包含，避免外部
 *   form1 实例在 hook 间传递）。源 setWalletInfo 签名 `(values) => Promise`，
 *   本组件 onSubmit 透传 `{ password }`，签名兼容 useWalletManagement.setWalletInfo。
 * - antd Input.Password → shared/ui Input type="password"。
 * - Heroicons InformationCircleIcon → lucide-react Info（项目图标库统一）。
 */
export interface GenerateWalletModalProps {
  /** Modal 开关（useWalletManagement.isModalOpen）。 */
  open: boolean;
  /** 取消回调（useWalletManagement.setIsModalOpen(false) + form1.reset）。 */
  onCancel: () => void;
  /**
   * 提交回调（useWalletManagement.setWalletInfo）。
   * 接收 `{ password }`，内部调 generateWalletKeystore + 回填 + 关闭。
   */
  onSubmit: (values: { password?: string }) => Promise<void> | void;
}

/** keystore 密码表单值（单字段）。 */
interface GenerateWalletFormValues {
  password: string;
}

export function GenerateWalletModal({
  open,
  onCancel,
  onSubmit,
}: GenerateWalletModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenerateWalletFormValues>({
    defaultValues: { password: '' },
  });

  // 打开时重置表单（对齐源 destroyOnClose）。
  React.useEffect(() => {
    if (open) {
      reset({ password: '' });
    }
  }, [open, reset]);

  const onValid = (values: GenerateWalletFormValues) => {
    onSubmit({ password: values.password });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>{t('PUB_Generate_Wallet')}</DialogTitle>
          <DialogDescription>{t('tokenized_deposit_0139')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <div className="mb-2">
            <label htmlFor="generate-wallet-password" className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0080')}
            </label>
            <Input
              id="generate-wallet-password"
              type="password"
              autoComplete="new-password"
              placeholder=""
              aria-invalid={!!errors.password}
              {...register('password', { required: true })}
            />
            <div className="mt-2 flex items-start text-sm text-primary">
              <Info className="mr-2 mt-0.5 h-5 w-5 shrink-0" />
              <span>{t('tokenized_deposit_0140')}</span>
            </div>
            {errors.password ? (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {t('tokenized_deposit_0080')}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6 flex-row justify-center gap-4 sm:justify-center">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit">{t('PUB_Confirm')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
