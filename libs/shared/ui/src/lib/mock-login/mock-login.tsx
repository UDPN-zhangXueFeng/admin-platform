'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { Separator } from '../separator';

/* -------------------------------------------------------------------------- */
/*  Props                                                                       */
/* -------------------------------------------------------------------------- */

export interface MockLoginPageProps {
  /** App title shown on the right panel (e.g. "Kissen Admin"). */
  projectName: string;
  /** Brand wordmark on the left panel (e.g. "kissen"). */
  brandText: string;
  /** Accent suffix next to the wordmark (e.g. "Admin", "Gateway"). */
  brandSuffix: string;
  /** Tagline below the wordmark. */
  brandTagline: string;
  /** Path to the illustration SVG served from the app's public dir. */
  svgPath: string;
  /** Cookie name written on submit — must match the middleware check. */
  cookieName: string;
  /** Post-login redirect path, locale-prefixed by the caller if needed. */
  redirectPath?: string;
  /** Left-panel gradient (Tailwind arbitrary value class). */
  gradientClass?: string;
  /** Brand wordmark base colour (Tailwind text-[…]). */
  brandBaseColor?: string;
  /** Brand wordmark accent letter colour. */
  brandAccentColor?: string;
  /** Brand suffix badge background colour. */
  brandSuffixBg?: string;
  /** Tagline text colour. */
  taglineColor?: string;
  /** Right-panel title colour. */
  titleColor?: string;
  /** Submit button label. */
  submitLabel?: string;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mock login page — branded split-screen layout matching the admin console.
 *
 * **No backend call.** On submit it writes a fake cookie (named via
 * `cookieName`) and calls `router.replace(redirectPath)`.
 *
 * Visual layout (≥ lg): left gradient panel with brand wordmark + SVG
 * illustration; right panel with the project title and a username/password
 * form. On small screens the left panel is hidden and only the form shows.
 *
 * Each Kissen / LP app passes its own `svgPath` and branding props; the
 * colour scheme defaults to the admin indigo palette.
 */
export function MockLoginPage({
  projectName,
  brandText,
  brandSuffix,
  brandTagline,
  svgPath,
  cookieName,
  redirectPath = '/dashboard',
  gradientClass = 'from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8]',
  brandBaseColor = 'text-[#001a98]',
  brandAccentColor = 'text-[#00a5d5]',
  brandSuffixBg = 'bg-[#00a5d5]',
  taglineColor = 'text-[#172260]',
  titleColor = 'text-[#554eea]',
  submitLabel = 'Sign In',
}: MockLoginPageProps) {
  const router = useRouter();

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      document.cookie = `${cookieName}=mock-token; path=/; max-age=86400`;
      router.replace(redirectPath);
    },
    [cookieName, redirectPath, router],
  );

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* ── Left: branded gradient panel ─────────────────────────────────── */}
      <section
        className={`relative hidden min-h-screen overflow-hidden bg-gradient-to-br ${gradientClass} lg:flex lg:flex-col lg:items-center lg:justify-center`}
      >
        <div className="relative z-10 flex h-full w-full max-w-[760px] flex-col px-16 py-12 xl:px-24">
          <div className="mt-auto">
            <div
              className="flex items-end justify-center"
              aria-label={`${brandText} ${brandSuffix}`}
            >
              <span
                className={`text-6xl font-black italic leading-none tracking-[-0.11em] ${brandBaseColor}`}
              >
                {brandText.charAt(0)}
                <span className={brandAccentColor}>
                  {brandText.slice(1)}
                </span>
              </span>
              <span
                className={`mb-1 ml-3 rounded-sm ${brandSuffixBg} px-2 py-0.5 text-base font-medium text-white`}
              >
                {brandSuffix}
              </span>
            </div>
            <p
              className={`mx-auto mt-10 max-w-[510px] text-2xl font-semibold leading-relaxed ${taglineColor}`}
            >
              {brandTagline}
            </p>
          </div>

          <div className="mt-7 flex min-h-0 flex-1 items-center justify-center">
            <img
              src={svgPath}
              alt=""
              width="720"
              height="560"
              className="h-auto max-h-[54vh] w-full max-w-[680px] select-none"
            />
          </div>
        </div>
      </section>

      {/* ── Right: form panel ─────────────────────────────────────────────── */}
      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-[480px]">
          <div className="mb-10 text-center">
            <h1
              className={`text-3xl font-bold leading-tight tracking-tight ${titleColor} sm:text-4xl`}
            >
              {projectName}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="Enter your username"
                defaultValue="admin"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                defaultValue="admin123"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              {submitLabel}
            </Button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <Separator className="flex-1 bg-slate-200" />
            <span className="text-sm text-slate-600">Demo Mode</span>
            <Separator className="flex-1 bg-slate-200" />
          </div>

          <p className="text-center text-sm text-slate-500">
            Mock authentication — no backend required.
          </p>
        </div>
      </section>
    </div>
  );
}
