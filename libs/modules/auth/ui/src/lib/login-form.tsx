'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useCallback, useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Label } from '@myorg/shared/ui';
import { loginSchema, type LoginFormValues } from '@myorg/modules/auth/util';
import { getCaptcha, useLoginMutation } from '@myorg/modules/auth/data-access';
import { useAuthUIStore } from '@myorg/modules/auth/data-access';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const DEFAULT_LOGIN_VALUES: LoginFormValues = IS_DEVELOPMENT
  ? { loginName: 'cuining', password: 'td#0415', code: '' }
  : { loginName: '', password: '', code: '' };

/**
 * Password login form — username + password + captcha.
 *
 * Fetches a captcha image on mount and after failed login attempts.
 * On success, either stores the session directly or switches to
 * the 2FA form (handled by the parent via authUIStore).
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const { captchaUrl, randomstr, setCaptcha, setTwoFactorToken, setLoginStep } =
    useAuthUIStore();
  const loginMutation = useLoginMutation();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: DEFAULT_LOGIN_VALUES,
  });

  /** Fetch captcha image + randomstr, and prefill the dev-only captcha code. */
  const refreshCaptcha = useCallback(async () => {
    try {
      const response = await getCaptcha();
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const rs = response.headers['randomstr'] ?? '';
      setCaptcha(url, rs);

      if (IS_DEVELOPMENT) {
        const captchaCode = response.headers['captchacode'];
        setValue('code', typeof captchaCode === 'string' ? captchaCode : '');
      }
    } catch {
      // Captcha fetch failure — form still usable without it
    }
  }, [setCaptcha]);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  useEffect(() => {
    return () => {
      if (captchaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(captchaUrl);
      }
    };
  }, [captchaUrl]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const result = await loginMutation.mutateAsync({
        ...values,
        randomstr,
      });

      // 2FA required — switch step
      if (result.twoFactorAuth && result.twoFactorToken) {
        setTwoFactorToken(result.twoFactorToken);
        setLoginStep('twoFactor');
      }
      // Direct login success is handled by useLoginMutation.onSuccess
    } catch {
      // Login failed — refresh captcha and clear code field
      refreshCaptcha();
      setValue('code', '');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
          {...register('loginName')}
        />
        {errors.loginName && (
          <p className="text-sm text-destructive">{errors.loginName.message}</p>
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
          <Input
            id="password"
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            className="h-11 rounded-md border-slate-300 bg-white pr-11 shadow-sm focus-visible:ring-[#554eea]"
            {...register('password')}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#554eea]"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-label={
              isPasswordVisible ? t('hidePassword') : t('showPassword')
            }
          >
            {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
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
            className="h-11 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            {...register('code')}
          />
          {captchaUrl && (
            <img
              src={captchaUrl}
              alt={t('captcha')}
              className="h-11 w-40 cursor-pointer border-l border-slate-300 object-fill"
              onClick={refreshCaptcha}
              title={t('captchaRefresh')}
            />
          )}
        </div>
        {errors.code && (
          <p className="text-sm text-destructive">{errors.code.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="mt-8 h-11 w-full rounded-md bg-[#554eea] text-white shadow-sm hover:bg-[#4841dc]"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? t('loggingIn') : t('login')}
        {!loginMutation.isPending && (
          <ArrowRight size={16} aria-hidden="true" />
        )}
      </Button>

      {loginMutation.isError && (
        <p className="text-center text-sm text-destructive">
          {loginMutation.error instanceof Error
            ? loginMutation.error.message
            : t('loginFailed')}
        </p>
      )}
    </form>
  );
}
