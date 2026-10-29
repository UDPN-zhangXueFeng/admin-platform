import dynamic from 'next/dynamic';

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
  return <LoginPage />;
}
