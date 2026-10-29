/**
 * AdminWalletApprovalForm — AdminWalletModal「Approval」态钱包审批表单。
 *
 * 源: admin-wallet-modal.tsx 135-139（ApprovalFormValues）、250-254（useForm）、
 * 256-263（打开重置 effect Approval 分支）、297-309（审批提交）、410-504（表单 JSX）。
 * 仅在 ctx.type==='Approval' 时由 AdminWalletModal 渲染。
 */
'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  DialogFooter,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@myorg/shared/ui';
import { useApprovalAdminWalletMutation } from '@myorg/modules/td-admin/data-access';
import type { AdminWalletCtx } from './admin-wallet-modal';

/** Approval 表单值。 */
interface ApprovalFormValues {
  state: string;
  remark?: string;
}

/** AdminWalletApprovalForm props（由 AdminWalletModal 透传）。 */
interface AdminWalletApprovalFormProps {
  /** Modal 开关（打开时重置表单）。 */
  open: boolean;
  /** Approval 态上下文（源 adminWalletModalInfo）。 */
  ctx: AdminWalletCtx;
  /** 取消回调。 */
  onCancel: () => void;
}

/**
 * Approval 态表单（原 AdminWalletModal 内 ctx.type==='Approval' 分支整体迁出）。
 */
export function AdminWalletApprovalForm({
  open,
  ctx,
  onCancel,
}: AdminWalletApprovalFormProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync: approvalAsync, isPending: approvalPending } =
    useApprovalAdminWalletMutation();

  // ── Approval 表单 ──
  const approvalForm = useForm<ApprovalFormValues>({
    defaultValues: { state: '20', remark: '' },
  });

  // 打开时重置表单（对齐源 destroyOnClose + setFieldsValue）。
  // 仅依赖 open/type，form.reset 引用 stable 不纳入依赖。
  React.useEffect(() => {
    if (!open) return;
    approvalForm.reset({ state: '20', remark: '' });
  }, [open]);

  // Approval 提交（源 1104-1108）。
  const onApprovalSubmit = async (values: ApprovalFormValues) => {
    try {
      await approvalAsync({
        recordId: ctx.id,
        remark: values.remark,
        state: values.state,
      });
      toast.success(t('PUB_Success').replace('****', t('PUB_Submit')));
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  return (
    <form
      onSubmit={approvalForm.handleSubmit(onApprovalSubmit)}
      noValidate
    >
      {/* walletType disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('tokenized_deposit_0075')}
        </Label>
        <Input value={ctx.walletType ?? ''} disabled readOnly />
      </div>
      {/* originalWalletAddress disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('tokenized_deposit_0081')}
        </Label>
        <Input
          value={ctx.originalWalletAddress ?? ''}
          disabled
          readOnly
        />
      </div>
      {/* walletAddress disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('tokenized_deposit_0053')}
        </Label>
        <Input value={ctx.walletAddress ?? ''} disabled readOnly />
      </div>
      {/* status disabled */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('PUB_Status')}
        </Label>
        <Input value={ctx.status ?? ''} disabled readOnly />
      </div>
      {/* state Radio Approve/Reject（Radix RadioGroup 用 value/onValueChange，需 Controller） */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('PUB_Examine')}
        </Label>
        <Controller
          control={approvalForm.control}
          name="state"
          rules={{ required: true }}
          render={({ field }) => (
            <RadioGroup
              value={(field.value as string) ?? '20'}
              onValueChange={field.onChange}
              className="flex"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="20" />
                {t('PUB_Approve')}
              </label>
              <label className="ml-4 flex items-center gap-2 text-sm">
                <RadioGroupItem value="15" />
                {t('PUB_Reject')}
              </label>
            </RadioGroup>
          )}
        />
      </div>
      {/* remark */}
      <div className="mb-4">
        <Label className="mb-1.5 block text-sm font-medium">
          {t('PUB_Comment')}
        </Label>
        <Controller
          control={approvalForm.control}
          name="remark"
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

      <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('PUB_Cancel')}
        </Button>
        <Button type="submit" disabled={approvalPending}>
          {t('PUB_Submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
