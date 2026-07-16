'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { clearSessionStorage, useAuth } from '@myorg/shared/util-auth';
import { useConfig } from '@myorg/shared/util-config';
import {
  LoginForm,
  TwoFactorForm,
  MetaMaskButton,
} from '@myorg/modules/auth/ui';
import { useAuthUIStore } from '@myorg/modules/auth/data-access';
import { Separator } from '@myorg/shared/ui';

/**
 * Login page — assembles all three login modes.
 *
 * Desktop uses a branded split layout; smaller screens keep the form-only panel.
 * The form switches from password to 2FA after a successful first step.
 *
 * Authenticated users are redirected to the dashboard by the parent layout.
 */
export function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { config } = useConfig();
  const { isAuthenticated } = useAuth();
  const { loginStep, reset } = useAuthUIStore();

  // Redirect authenticated users away from login
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // Align with td-manage: entering the login page clears the previous session footprint.
  useEffect(() => {
    clearSessionStorage();
    reset();
  }, [reset]);

  // Reset auth UI store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="relative z-10 flex h-full w-full max-w-[760px] flex-col px-16 py-12 xl:px-24">
          <div className="mt-auto">
            <div
              className="flex items-end justify-center"
              aria-label="UDPN Solutions"
            >
              <span className="text-6xl font-black italic leading-none tracking-[-0.11em] text-[#001a98]">
                u<span className="text-[#00a5d5]">d</span>pn
              </span>
              <span className="mb-1 ml-3 rounded-sm bg-[#00a5d5] px-2 py-0.5 text-base font-medium text-white">
                Solutions
              </span>
            </div>
            <p className="mx-auto mt-10 max-w-[510px] text-2xl font-semibold leading-relaxed text-[#172260]">
              {t('brandTagline')}
            </p>
          </div>

          <div className="mt-7 flex min-h-0 flex-1 items-center justify-center">
            {/* The SVG is intentionally external so it stays cacheable and small. */}
            <img
              src="/login-network.svg"
              alt=""
              width="720"
              height="560"
              className="h-auto max-h-[54vh] w-full max-w-[680px] select-none"
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-[480px]">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#554eea] sm:text-4xl">
              {config.project.name}
            </h1>
          </div>

          {loginStep === 'password' && <LoginForm />}
          {loginStep === 'twoFactor' && <TwoFactorForm />}

          {loginStep === 'password' && (
            <>
              <div className="my-8 flex items-center gap-4">
                <Separator className="flex-1 bg-slate-200" />
                <span className="text-sm text-slate-600">{t('or')}</span>
                <Separator className="flex-1 bg-slate-200" />
              </div>

              <MetaMaskButton />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
