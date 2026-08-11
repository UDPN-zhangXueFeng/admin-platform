'use client';

import { MockLoginPage } from '@myorg/shared/ui';

/**
 * MOCK login route — /[locale]/login
 *
 * Uses the shared branded split-screen MockLoginPage (admin-style layout).
 * No backend call: on submit it writes a fake `kissen_admin_token` cookie
 * and redirects to the dashboard.
 *
 * The illustration SVG lives in the app's public/ dir and is per-app
 * themed (indigo/blue for Kissen Admin).
 */
export default function LoginRoute() {
  return (
    <MockLoginPage
      projectName="Kissen Admin"
      brandText="kissen"
      brandSuffix="Admin"
      brandTagline="Stablecoin settlement and liquidity operations console."
      svgPath="/login-illustration.svg"
      cookieName="kissen_admin_token"
      redirectPath="/dashboard"
      gradientClass="from-[#c6c7ff] via-[#8e8af5] to-[#4e48e8]"
      brandBaseColor="text-[#001a98]"
      brandAccentColor="text-[#00a5d5]"
      brandSuffixBg="bg-[#00a5d5]"
      taglineColor="text-[#172260]"
      titleColor="text-[#554eea]"
      submitLabel="Sign In"
    />
  );
}
