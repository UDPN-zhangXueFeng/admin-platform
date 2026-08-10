'use client';

import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@myorg/shared/ui';

/**
 * MOCK login page.
 *
 * No backend call: on submit it writes a fake `kissen_admin_token` cookie
 * and redirects to the dashboard root. The cookie name MUST match the one
 * read by src/middleware.ts so the auth guard recognizes the session.
 *
 * i18n keys may be absent in mock mode; the safe `tr()` helper falls back to
 * a literal string if `useTranslations('auth')` throws or the key is missing.
 */
export default function LoginRoute() {
  const router = useRouter();
  const t = useTranslations('auth');

  // Fallback-aware translator: never throws on missing keys.
  const tr = (key: string, fallback: string) => {
    try {
      const value = t(key);
      return value === key ? fallback : value;
    } catch {
      return fallback;
    }
  };

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>{tr('title', 'Kissen Admin Login')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            document.cookie = 'kissen_admin_token=mock-token; path=/; max-age=86400';
            router.replace('/dashboard');
          }}
          className="space-y-4"
        >
          <Input placeholder={tr('username', 'Username')} defaultValue="admin" />
          <Input type="password" placeholder={tr('password', 'Password')} defaultValue="admin123" />
          <Button type="submit" className="w-full">
            {tr('submit', 'Sign In')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
