/**
 * RoleWallets Configure Wallet Modal（Unconfigured 行专属）。
 *
 * 源: role-wallets.tsx 171-190（Configure 按钮触发）、200-218（提交）、
 * 222-290（CustomModal 表单：roleName disabled + walletAddress required
 * + pattern ^0x[a-fA-F0-9]{40}$，Invalid Ethereum address format 硬编码英文）。
 * 提交 configureRoleWallet（上游 mock 恒 code 0、500ms），成功关窗 + 列表刷新
 * （源 mutate()）。上游 mock 13 行全 Active，按钮运行态不可达，迁移仅为
 * 功能对齐完整性（review NF-3 / TD-081，2026-10-28）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import {
  configureRoleWallet,
  type RoleWalletItem,
} from '@myorg/modules/td-admin/data-access';

interface ConfigureFormValues {
  walletAddress: string;
}

interface RoleWalletConfigureModalProps {
  open: boolean;
  selectedWallet: RoleWalletItem | null;
  onOpenChange: (open: boolean) => void;
  /** 提交成功（code 0）后回调（父组件关窗 + 刷新列表，源 mutate()）。 */
  onConfigured: () => void;
}

export function RoleWalletConfigureModal({
  open,
  selectedWallet,
  onOpenChange,
  onConfigured,
}: RoleWalletConfigureModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConfigureFormValues>({
    defaultValues: { walletAddress: '' },
  });

  // 打开时复位（源 configForm.resetFields()）。
  React.useEffect(() => {
    if (open) {
      reset({ walletAddress: '' });
    }
  }, [open, reset]);

  const onSubmit = async (values: ConfigureFormValues) => {
    if (!selectedWallet) {
      return;
    }
    // 源 handleConfigureWallet：Promise 包裹 configureRoleWalletApi，
    // code 0 关窗 + mutate() 刷新列表。
    const res = await configureRoleWallet({
      // 源 handleConfigureWallet：roleWalletId 取 data.roleWalletId ?? ''。
      roleWalletId: selectedWallet.roleWalletId ?? '',
      walletAddress: values.walletAddress,
      additionalParams: { ...values },
    });
    if (res.code === 0) {
      onConfigured();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('configure_wallet_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="configure-roleName">{t('role_name')}</Label>
            <Input
              id="configure-roleName"
              value={selectedWallet?.roleName ?? ''}
              disabled
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="configure-walletAddress">
              {t('wallet_address')}
            </Label>
            <Input
              id="configure-walletAddress"
              placeholder={t('enter_wallet_address')}
              aria-invalid={Boolean(errors.walletAddress)}
              {...register('walletAddress', {
                required: t('PUB_Pleased').replace(
                  '****',
                  t('wallet_address'),
                ),
                pattern: {
                  value: /^0x[a-fA-F0-9]{40}$/,
                  message: 'Invalid Ethereum address format',
                },
              })}
            />
            {errors.walletAddress ? (
              <p className="text-sm text-destructive">
                {errors.walletAddress.message}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('PUB_Submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
