'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Input, Label, PasswordField } from '@myorg/shared/ui';
import {
  createLoginSchema,
  type LoginFormValues,
} from '@myorg/modules/td-admin/data-access/lib/auth/validation';
import { useLoginMutation } from '@myorg/modules/td-admin/data-access/lib/auth';
import { useAuthUIStore } from '@myorg/modules/td-admin/data-access/lib/auth';
import { useCaptcha } from './use-captcha';
import { useAuthValidationMessages } from './use-auth-validation-messages';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const CAPTCHA_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_VALUES: LoginFormValues = {
  loginName: '',
  password: '',
  code: '',
};

/**
 * Password login form — username + password + captcha.
 *
 * Fetches a captcha image on mount and after failed login attempts.
 * On success, either stores the session directly or switches to
 * the 2FA form (handled by the parent via authUIStore).
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const { setTwoFactorToken, setLoginStep } = useAuthUIStore();
  const { captchaUrl, randomstr, refreshCaptcha } = useCaptcha();
  const loginMutation = useLoginMutation();

  const validationMessages = useAuthValidationMessages();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(createLoginSchema(validationMessages)),
    defaultValues: DEFAULT_LOGIN_VALUES,
  });

  /**
   * Pull a new captcha. The dev backend also returns the expected code in a
   * response header, which is prefilled to keep local sign-in usable.
   */
  const loadCaptcha = React.useCallback(
    async (clearCode: boolean) => {
      try {
        const { captchaCode } = await refreshCaptcha();
        if (IS_DEVELOPMENT && captchaCode) {
          setValue('code', captchaCode);
        } else if (clearCode) {
          setValue('code', '');
        }
      } catch {
        // Captcha fetch failure — the form stays usable and the image can be retried.
      }
    },
    [refreshCaptcha, setValue]
  );

  React.useEffect(() => {
    void loadCaptcha(false);
  }, [loadCaptcha]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCaptcha(true);
    }, CAPTCHA_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadCaptcha]);

  const onSubmit = async (values: LoginFormValues) => {
    clearErrors('root');

    try {
      const result = await loginMutation.mutateAsync({
        ...values,
        randomstr,
      });

      // 2FA required — switch step
      if (result.twoFactorAuth && result.twoFactorToken) {
        setTwoFactorToken(result.twoFactorToken);
        setLoginStep('twoFactor');
        return;
      }

      // The login page owns the post-login navigation so the active locale is kept.
    } catch (e) {
      // Login failed — surface the backend message and refresh the captcha.
      setError('root', {
        message: (e as Error).message || t('loginFailed'),
      });
      void loadCaptcha(true);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2.5">
        <Label
          htmlFor="loginName"
          className="text-sm font-normal uppercase text-slate-700"
        >
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
          {t('username')}
        </Label>
        <Input
          id="loginName"
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          aria-invalid={Boolean(errors.loginName)}
          className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
          {...register('loginName')}
        />
        {errors.loginName && (
          <p className="text-sm text-destructive" role="alert">
            {errors.loginName.message}
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <Label
          htmlFor="password"
          className="text-sm font-normal uppercase text-slate-700"
        >
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
          {t('password')}
        </Label>
        <div className="relative">
          <PasswordField
            id="password"
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            showLabel={t('showPassword')}
            hideLabel={t('hidePassword')}
            className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <Label
          htmlFor="code"
          className="text-sm font-normal uppercase text-slate-700"
        >
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
          {t('captcha')}
        </Label>
        <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#554eea] focus-within:ring-offset-2">
          <Input
            id="code"
            autoComplete="off"
            placeholder={t('captchaPlaceholder')}
            aria-invalid={Boolean(errors.code)}
            className="h-11 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            {...register('code')}
          />
          {captchaUrl && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-40 shrink-0 rounded-none border-l border-slate-300 bg-transparent p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[#554eea]"
              aria-label={t('captchaRefresh')}
              title={t('captchaRefresh')}
              onClick={() => {
                void loadCaptcha(true);
              }}
            >
              <img
                src={captchaUrl}
                alt=""
                className="h-full w-full cursor-pointer object-fill"
              />
            </Button>
          )}
        </div>
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
        className="mt-8 h-11 w-full rounded-md bg-[#554eea] text-white shadow-sm hover:bg-[#4841dc]"
        disabled={loginMutation.isPending}
        aria-busy={loginMutation.isPending}
      >
        {loginMutation.isPending ? t('loggingIn') : t('login')}
        {!loginMutation.isPending && (
          <ArrowRight size={16} aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
