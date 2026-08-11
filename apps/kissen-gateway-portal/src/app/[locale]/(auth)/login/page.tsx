'use client';

import { MockLoginPage } from '@myorg/shared/ui';

/**
 * MOCK login route — /[locale]/login
 *
 * Uses the shared branded split-screen MockLoginPage (admin-style layout).
 * No backend call: on submit it writes a fake `kissen_gateway_token` cookie
 * and redirects to the dashboard.
 *
 * The illustration SVG lives in the app's public/ dir (shared indigo theme).
 */
export default function LoginRoute() {
  return (
    <MockLoginPage
      projectName="Kissen Gateway"
      brandText="kissen"
      brandSuffix="Gateway"
      brandTagline="Gateway access, trading, and system management portal."
      svgPath="/login-illustration.svg"
      cookieName="kissen_gateway_token"
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
