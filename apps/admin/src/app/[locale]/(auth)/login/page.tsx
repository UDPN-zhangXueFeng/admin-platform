'use client';

import dynamic from 'next/dynamic';

import { markHeaderSweepOnLogin } from '@/lib/header-sweep';

const LoginPage = dynamic(
  () => import('@myorg/modules/td-admin/feature/lib/auth').then((module) => module.LoginPage),
);

/**
 * Login route — /[locale]/login
 *
 * Rendered inside the (auth) layout which provides a minimal
 * centered card without sidebar/header.
 */
export default function LoginRoute() {
  return <LoginPage onLoginSuccess={markHeaderSweepOnLogin} />;
}
