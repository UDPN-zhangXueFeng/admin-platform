'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button, Input, Label } from '@myorg/shared/ui';
import {
  createTwoFactorSchema,
  type TwoFactorFormValues,
} from '@myorg/modules/td-admin/data-access';
import {
  useTwoFactorMutation,
  useAuthUIStore,
} from '@myorg/modules/td-admin/data-access';
import { useAuthValidationMessages } from './use-auth-validation-messages';

/**
 * Two-factor authentication form — 6-digit verification code.
 *
 * Displayed after password login when the backend indicates 2FA is enabled.
 * The `twoFactorToken` is stored in authUIStore and passed with the request.
 */
export function TwoFactorForm() {
  const t = useTranslations('auth');
  const { twoFactorToken, setLoginStep, setTwoFactorToken } = useAuthUIStore();
  const twoFactorMutation = useTwoFactorMutation();

  const validationMessages = useAuthValidationMessages();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<TwoFactorFormValues>({
    resolver: zodResolver(createTwoFactorSchema(validationMessages)),
    defaultValues: { code: '' },
  });

  const onSubmit = async (values: TwoFactorFormValues) => {
    if (!twoFactorToken) return;

    clearErrors('root');

    try {
      await twoFactorMutation.mutateAsync({
        code: values.code,
        twoFactorToken,
      });
      // Success is handled by useTwoFactorMutation.onSuccess
    } catch (e) {
      setError('root', {
        message: (e as Error).message || t('twoFactorFailed'),
      });
    }
  };

  const handleBack = () => {
    setTwoFactorToken(null);
    setLoginStep('password');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">
          {t('twoFactorTitle')}
        </h2>
        <p className="text-sm text-slate-600">{t('twoFactorDescription')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="twoFactorCode">{t('twoFactorCode')}</Label>
        <Input
          id="twoFactorCode"
          placeholder={t('twoFactorPlaceholder')}
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          aria-invalid={Boolean(errors.code)}
          className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
          {...register('code')}
        />
        {errors.code && (
          <p className="text-sm text-destructive" role="alert">
            {errors.code.message}
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

      <Button
        type="submit"
        className="h-11 w-full rounded-md bg-[#554eea] text-white shadow-sm hover:bg-[#4841dc]"
        disabled={twoFactorMutation.isPending}
        aria-busy={twoFactorMutation.isPending}
      >
        {twoFactorMutation.isPending ? t('verifying') : t('verify')}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={handleBack}
        disabled={twoFactorMutation.isPending}
      >
        {t('backToLogin')}
      </Button>
    </form>
  );
}
