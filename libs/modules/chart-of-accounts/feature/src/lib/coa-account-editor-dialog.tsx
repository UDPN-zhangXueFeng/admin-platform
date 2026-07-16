'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@myorg/shared/ui';
import type {
  AccountEditorFormValues,
  CoaModalState,
} from '@myorg/modules/chart-of-accounts/data-access';

/**
 * 新建 / 编辑账户 Dialog（迁移自源 AccountEditorModal.tsx）。
 *
 * antd Modal + Form + Switch/Input → shared/ui Dialog + react-hook-form
 * （Controller 驱动 Switch；动态字段：子账户用 accountCodeSuffix 2 位，
 *  主账户/编辑用 accountCode 4 位；allowPosting 关闭时联动 suspenseAccount 关闭）。
 */
export interface CoaAccountEditorDialogProps {
  open: boolean;
  modalState: CoaModalState;
  accountTypeLabel: string;
  balanceSide: string;
  recordName: string;
  parentRecordName: string;
  parentAccountCode?: string;
  isParentAccount: boolean;
  submitting: boolean;
  title: string;
  newPrimaryHint?: string;
  subAccountAlert?: string;
  /** 翻译函数（由上层 useTranslations 提供）。 */
  t: (key: string) => string;
  onSubmit: (values: AccountEditorFormValues) => void;
  onCancel: () => void;
}

export function CoaAccountEditorDialog({
  open,
  modalState,
  accountTypeLabel,
  balanceSide,
  recordName,
  parentRecordName,
  parentAccountCode,
  isParentAccount,
  submitting,
  title,
  newPrimaryHint,
  subAccountAlert,
  t,
  onSubmit,
  onCancel,
}: CoaAccountEditorDialogProps) {
  const isNewPrimary = modalState?.type === 'new-primary-account';
  const isNewSubAccount = modalState?.type === 'new-sub-account';
  const isEdit = modalState?.type === 'edit';
  const record =
    modalState && modalState.type !== 'new-primary-account' ? modalState.record : null;
  const isSubAccount = isNewSubAccount || (isEdit && !!record?.parentCode);
  const showSuspenseAccount = isNewPrimary || isNewSubAccount || isEdit;
  const disableAccountCode = isEdit && !!record?.bookAccountId;

  const { register, handleSubmit, control, reset, setValue, watch } =
    useForm<AccountEditorFormValues>({ defaultValues: {} });

  useEffect(() => {
    if (open && modalState) {
      const description =
        record?.description && record.description !== '--' ? record.description : '';
      reset({
        accountCode: isSubAccount ? undefined : record?.accountCode ?? '',
        accountCodeSuffix: isSubAccount
          ? record?.accountCode?.split('.').pop() ?? ''
          : undefined,
        accountName: record?.accountName ?? '',
        allowPosting: record?.allowPosting ?? false,
        suspenseAccount: record?.suspenseAccount ?? false,
        description,
      });
    }
  }, [open, modalState, record, isSubAccount, reset]);

  if (
    !open ||
    !modalState ||
    modalState.type === 'deactivate' ||
    modalState.type === 'activate'
  ) {
    return null;
  }

  const allowPostingValue = watch('allowPosting');
  const parentDisplay = isNewSubAccount
    ? recordName
    : parentRecordName || parentAccountCode || '--';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isNewPrimary && newPrimaryHint ? (
            <p className="text-sm text-muted-foreground">{newPrimaryHint}</p>
          ) : null}

          {isNewSubAccount && subAccountAlert ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {subAccountAlert}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t('coa.accountType')}</Label>
              <Input value={accountTypeLabel} disabled />
            </div>
            <div className="space-y-1">
              <Label>{t('coa.balanceSide')}</Label>
              <Input value={balanceSide} disabled />
            </div>
          </div>

          {isSubAccount ? (
            <div className="space-y-1">
              <Label>{t('coa.parentAccount')}</Label>
              <Input value={parentDisplay} disabled />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>{t('coa.accountCode')}</Label>
            {isSubAccount && parentAccountCode ? (
              <div className="flex items-center">
                <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm">
                  {parentAccountCode}.
                </span>
                <input
                  {...register('accountCodeSuffix', {
                    required: t('coa.codeRequired'),
                    pattern: { value: /^\d{2}$/, message: t('coa.code2Digit') },
                  })}
                  maxLength={2}
                  disabled={disableAccountCode}
                  placeholder="2-digit"
                  className="flex h-9 w-full rounded-r-md border bg-background px-3 text-sm"
                />
              </div>
            ) : (
              <input
                {...register('accountCode', {
                  required: t('coa.codeRequired'),
                  pattern: { value: /^\d{4}$/, message: t('coa.code4Digit') },
                })}
                disabled={disableAccountCode}
                placeholder="4 digits"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            )}
          </div>

          <div className="space-y-1">
            <Label>{t('coa.accountName')}</Label>
            <input
              {...register('accountName', {
                required: t('coa.nameRequired'),
                maxLength: { value: 50, message: t('coa.nameMax') },
                pattern: { value: /^[A-Za-z\s-]+$/, message: t('coa.namePattern') },
              })}
              maxLength={50}
              placeholder={t('coa.accountName')}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label>{t('coa.allowPosting')}</Label>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="allowPosting"
                  render={({ field }) => (
                    <Switch
                      checked={!!field.value}
                      disabled={isParentAccount}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) setValue('suspenseAccount', false);
                      }}
                    />
                  )}
                />
                <span className="text-sm">{allowPostingValue ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {showSuspenseAccount ? (
              <div className="space-y-1">
                <Label>{t('coa.suspenseAccount')}</Label>
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="suspenseAccount"
                    render={({ field }) => (
                      <Switch
                        checked={!!field.value}
                        disabled={isParentAccount || !allowPostingValue}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <span className="text-sm">
                    {watch('suspenseAccount') ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label>{t('coa.description')}</Label>
            <textarea
              {...register('description', {
                required: t('coa.descriptionRequired'),
              })}
              rows={4}
              maxLength={200}
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
