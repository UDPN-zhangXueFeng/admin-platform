'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  PasswordField,
  useToast,
} from '@myorg/shared/ui';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import {
  createChangePasswordSchema,
  evaluatePasswordPolicy,
  useChangePasswordMutation,
  type ChangePasswordFormValues,
} from '@myorg/modules/td-admin/data-access';
import { useAuthValidationMessages } from './use-auth-validation-messages';

export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Self-service password change dialog.
 *
 * Ported from the old td-manage page `src/pages/change-password/index.tsx`:
 * three password fields, the four-rule strength checklist that the old page
 * rendered as a disabled checkbox group, and the forced re-login after a
 * successful change.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const t = useTranslations('auth');
  const toast = useToast();
  const mutation = useChangePasswordMutation();

  const validationMessages = useAuthValidationMessages();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(createChangePasswordSchema(validationMessages)),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const policy = React.useMemo(
    () => evaluatePasswordPolicy(newPassword ?? ''),
    [newPassword]
  );

  // Reset the form whenever the dialog is closed.
  React.useEffect(() => {
    if (!open) {
      reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    clearErrors('root');
    mutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success(t('changePasswordSuccess'));
          onOpenChange(false);
          // The old project forced a re-login after a password change.
          logoutAndRedirect();
        },
        onError: (error) => {
          setError('root', {
            message: (error as Error).message || t('changePasswordFailed'),
          });
        },
      }
    );
  });

  const policyItems = [
    { key: 'length', label: t('passwordPolicyLength'), checked: policy.length },
    {
      key: 'mixedCase',
      label: t('passwordPolicyMixedCase'),
      checked: policy.mixedCase,
    },
    { key: 'digit', label: t('passwordPolicyDigit'), checked: policy.digit },
    { key: 'symbol', label: t('passwordPolicySymbol'), checked: policy.symbol },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('changePasswordTitle')}</DialogTitle>
          <DialogDescription>
            {t('changePasswordDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="oldPassword">
              {t('oldPassword')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <PasswordField
              id="oldPassword"
              autoComplete="current-password"
              maxLength={50}
              aria-invalid={Boolean(errors.oldPassword)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
              {...register('oldPassword')}
            />
            {errors.oldPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.oldPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">
              {t('newPassword')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <PasswordField
              id="newPassword"
              autoComplete="new-password"
              maxLength={50}
              aria-invalid={Boolean(errors.newPassword)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <ul className="space-y-1.5" aria-label={t('passwordPolicyTitle')}>
            {policyItems.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <Checkbox checked={item.checked} disabled />
                <span
                  className={
                    item.checked
                      ? 'text-sm text-slate-700'
                      : 'text-sm text-slate-400'
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">
              {t('confirmNewPassword')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <PasswordField
              id="confirmPassword"
              autoComplete="new-password"
              maxLength={50}
              aria-invalid={Boolean(errors.confirmPassword)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {errors.root?.message && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-[#554eea] text-white hover:bg-[#4841dc]"
              disabled={mutation.isPending}
              aria-busy={mutation.isPending}
            >
              {mutation.isPending ? t('changing') : t('changePasswordSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
