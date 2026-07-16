'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@myorg/shared/ui';
import {
  twoFactorSchema,
  type TwoFactorFormValues,
} from '@myorg/modules/auth/util';
import { useTwoFactorMutation, useAuthUIStore } from '@myorg/modules/auth/data-access';

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = async (values: TwoFactorFormValues) => {
    if (!twoFactorToken) return;

    try {
      await twoFactorMutation.mutateAsync({
        code: values.code,
        twoFactorToken,
      });
      // Success is handled by useTwoFactorMutation.onSuccess
    } catch {
      // Error displayed via twoFactorMutation.isError
    }
  };

  const handleBack = () => {
    setTwoFactorToken(null);
    setLoginStep('password');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="twoFactorCode">{t('twoFactorCode')}</Label>
        <Input
          id="twoFactorCode"
          placeholder={t('twoFactorPlaceholder')}
          maxLength={6}
          autoComplete="one-time-code"
          {...register('code')}
        />
        {errors.code && (
          <p className="text-sm text-destructive">{errors.code.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={twoFactorMutation.isPending}
      >
        {twoFactorMutation.isPending ? t('verifying') : t('verify')}
      </Button>

      {twoFactorMutation.isError && (
        <p className="text-center text-sm text-destructive">
          {twoFactorMutation.error instanceof Error
            ? twoFactorMutation.error.message
            : t('twoFactorFailed')}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={handleBack}
      >
        {t('backToLogin')}
      </Button>
    </form>
  );
}
