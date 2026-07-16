import { LoginPage } from '@myorg/modules/auth/feature';

/**
 * Login route — /[locale]/login
 *
 * Rendered inside the (auth) layout which provides a minimal
 * centered card without sidebar/header.
 */
export default function LoginRoute() {
  return <LoginPage />;
}
