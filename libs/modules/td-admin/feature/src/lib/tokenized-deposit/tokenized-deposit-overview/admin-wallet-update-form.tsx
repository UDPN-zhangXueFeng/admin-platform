/**
 * AdminWalletUpdateForm — AdminWalletModal「Update」态钱包更新表单。
 *
 * 源: admin-wallet-modal.tsx 128-133（UpdateFormValues）、248（useForm）、
 * 256-278（打开重置 + 生成钱包结果回填 effect）、281-294（AES 加密提交）、
 * 325-408（表单 JSX）。仅在 ctx.type==='Update' 时由 AdminWalletModal 渲染。
 */
'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, DialogFooter, Input, Label } from '@myorg/shared/ui';
import { getEncryptionData } from '@myorg/modules/td-admin/data-access';
import { useUpdateAdminWalletMutation } from '@myorg/modules/td-admin/data-access';
import type {
  AdminWalletCtx,
  AdminWalletModalProps,
} from './admin-wallet-modal';

/** Update 表单值。 */
interface UpdateFormValues {
  chainAccountAddress?: string;
  privateKey?: string;
  password?: string;
}

/** AdminWalletUpdateForm props（由 AdminWalletModal 透传）。 */
interface AdminWalletUpdateFormProps {
  /** Modal 开关（打开时重置表单）。 */
  open: boolean;
  /** Update 态上下文（源 adminWalletModalInfo）。 */
  ctx: AdminWalletCtx;
  /** 取消回调。 */
  onCancel: () => void;
  /** 生成钱包入口回调（Shell 打开 GenerateWallet/RigsecWallet Modal）。 */
  onGenerateWallet?: () => void;
  /** 子生成 Modal 结果快照（回填 Update 表单）。 */
  generatedWallet?: AdminWalletModalProps['generatedWallet'];
  /** 回填消费完成回调（Shell 清快照，避免重复应用）。 */
  onGeneratedConsumed?: () => void;
}

/**
 * Update 态表单（原 AdminWalletModal 内 ctx.type==='Update' 分支整体迁出）。
 */
export function AdminWalletUpdateForm({
  open,
  ctx,
  onCancel,
  onGenerateWallet,
  generatedWallet,
  onGeneratedConsumed,
}: AdminWalletUpdateFormProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync: updateAsync, isPending: updatePending } =
    useUpdateAdminWalletMutation();

  const isKeystore = ctx.storageType === 'key_keystore';

  // ── Update 表单 ──
  const updateForm = useForm<UpdateFormValues>({});

  // 打开时重置表单（对齐源 destroyOnClose + setFieldsValue）。
  // 仅依赖 open/type，form.reset 引用 stable 不纳入依赖。
  React.useEffect(() => {
    if (!open) return;
    updateForm.reset({});
  }, [open]);

  // 生成结果回填（源 setFieldsValue：keystore/walletAddress/password → Update 表单；
  // rigsec 路径仅 walletAddress → chainAccountAddress）。快照消费后立即上抛清除。
  React.useEffect(() => {
    if (!open || !generatedWallet) return;
    const patch: UpdateFormValues = {};
    if (generatedWallet.keystore != null) patch.privateKey = generatedWallet.keystore;
    if (generatedWallet.walletAddress != null)
      patch.chainAccountAddress = generatedWallet.walletAddress;
    if (generatedWallet.password != null) patch.password = generatedWallet.password;
    if (Object.keys(patch).length > 0) {
      updateForm.reset({ ...updateForm.getValues(), ...patch });
      onGeneratedConsumed?.();
    }
  }, [open, generatedWallet, onGeneratedConsumed]);

  // Update 提交（源 1096-1102）：password AES 加密后提交。
  const onUpdateSubmit = async (values: UpdateFormValues) => {
    try {
      await updateAsync({
        accountId: ctx.id,
        chainAccountAddress: values.chainAccountAddress,
        password: values.password ? getEncryptionData(values.password) : '',
        privateKey: values.privateKey,
      });
      toast.success(t('PUB_Success').replace('****', t('PUB_Save')));
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  return (
    <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} noValidate>
      {/* walletType disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('tokenized_deposit_0075')}
        </Label>
        <Input value={ctx.walletType ?? ''} disabled readOnly />
      </div>
      {/* walletAddress disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('tokenized_deposit_0053')}
        </Label>
        <Input value={ctx.walletAddress ?? ''} disabled readOnly />
      </div>

      {/* chainAccountAddress + 生成钱包入口（源 2339-2392） */}
      <div className="mb-4">
        <div className="mb-1.5 flex w-full items-center justify-between">
          <Label className="block text-sm font-medium">
            {t('tokenized_deposit_0078')}
          </Label>
          <button
            type="button"
            className="cursor-pointer text-sm text-primary underline"
            onClick={onGenerateWallet}
          >
            {t('PUB_Generate_Wallet')}
          </button>
        </div>
        <Input
          disabled={!isKeystore}
          aria-invalid={!!updateForm.formState.errors.chainAccountAddress}
          {...updateForm.register('chainAccountAddress', { required: true })}
        />
      </div>

      {/* keystore 路径才显示 privateKey + password（源 2395-2418） */}
      {isKeystore ? (
        <>
          <div className="mb-4">
            <Label className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0079')}
            </Label>
            <Controller
              control={updateForm.control}
              name="privateKey"
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <textarea
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  rows={3}
                  aria-invalid={!!fieldState.error}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}
            />
          </div>
          <div className="mb-4">
            <Label className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0080')}
            </Label>
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={!!updateForm.formState.errors.password}
              {...updateForm.register('password', { required: true })}
            />
          </div>
        </>
      ) : null}

      <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('PUB_Cancel')}
        </Button>
        <Button type="submit" disabled={updatePending}>
          {t('PUB_Save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
