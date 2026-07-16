/**
 * GenerateWalletModal — overview 钱包管理用 keystore 钱包生成密码 Modal。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 generate CustomModal
 * （源 2473-2544）+ setWalletInfo（源 1743-1762）。
 *
 * ## 触发（源 2364-2368）
 *
 * AdminWalletModal Update 态点「Generate Wallet」且 storageType==='key_keystore'
 * 时，Shell 打开本 Modal。
 *
 * ## 提交（源 setWalletInfo）
 *
 * react-hook-form 受控 password（required），onSubmit → useGenerateWalletKeystoreMutation
 * （password 明文，API 内部 AES 加密）。成功回填 walletAddress/keystore 到
 * AdminWalletModal 表单（onSuccess 透传 { walletAddress, keystore, password }）。
 *
 * ## 与 edit 版差异
 *
 * edit 版 GenerateWalletModal（tokenized-deposit-edit/）是纯展示组件，onSubmit
 * 透传 { password } 给 useWalletManagement.setWalletInfo；overview 版直接持有
 * useGenerateWalletKeystoreMutation（无 useWalletManagement hook 依赖），回填
 * 通过 props.onGenerated 回调（Shell 写回 adminWallet 表单）。逻辑等价但解耦。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
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
import { useGenerateWalletKeystoreMutation } from '@myorg/modules/tokenized-deposit/data-access';

export interface OverviewGenerateWalletModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** chainType（generateWalletKeystore body，源 adminWalletModalInfo.chainType）。 */
  chainType: string;
  /** 取消回调。 */
  onCancel: () => void;
  /**
   * 生成成功回调（Shell 回填 adminWallet 表单）。
   * 接收 { walletAddress, keystore, password }（源 setFieldsValue）。
   */
  onGenerated: (result: {
    walletAddress?: string;
    keystore?: string;
    password: string;
  }) => void;
}

/** keystore 密码表单值。 */
interface GenerateWalletFormValues {
  password: string;
}

/**
 * overview 版 Generate Wallet Modal。
 *
 * 用法：
 * ```tsx
 * <OverviewGenerateWalletModal
 *   open={generateIsModalOpen}
 *   chainType={adminCtx.chainType ?? ''}
 *   onCancel={() => setGenerateIsModalOpen(false)}
 *   onGenerated={({ walletAddress, keystore, password }) => {/* 回填 *\/}}
 * />
 * ```
 */
export function OverviewGenerateWalletModal({
  open,
  chainType,
  onCancel,
  onGenerated,
}: OverviewGenerateWalletModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync, isPending } = useGenerateWalletKeystoreMutation();

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

  const onValid = async (values: GenerateWalletFormValues) => {
    try {
      const res = await mutateAsync({
        chainType,
        storageType: 'key_keystore',
        password: values.password,
      });
      onGenerated({
        walletAddress: res?.walletAddress,
        keystore: res?.keystore,
        password: values.password,
      });
      // 源 setWalletInfo 成功后无 toast（注释 message.success），保持静默。
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('PUB_Generate_Wallet')}</DialogTitle>
          <DialogDescription>{t('tokenized_deposit_0139')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <div className="mb-2">
            <label
              htmlFor="overview-generate-wallet-password"
              className="mb-1.5 block text-sm font-medium"
            >
              {t('tokenized_deposit_0080')}
            </label>
            <Input
              id="overview-generate-wallet-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password', { required: true })}
            />
            <div className="mt-2 flex items-start text-sm text-primary">
              <Info className="mr-2 mt-0.5 h-5 w-5 shrink-0" />
              <span>{t('tokenized_deposit_0140')}</span>
            </div>
            {errors.password ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {t('tokenized_deposit_0080')}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6 flex-row justify-center gap-4 sm:justify-center">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t('PUB_Confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
