'use client';

import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';

/**
 * Mock login route — /[locale]/login
 *
 * In mock mode there is no real backend. Submitting the form writes a fake
 * `lp_portal_token` cookie (the same name the middleware reads) and redirects
 * to the app root, satisfying the auth guard without any API call.
 */
export default function LoginRoute() {
  const router = useRouter();
  const t = useTranslations('auth');

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            document.cookie = 'lp_portal_token=mock-token; path=/; max-age=86400';
            router.replace('/dashboard');
          }}
          className="space-y-4"
        >
          <Input placeholder="Username" defaultValue="admin" />
          <Input type="password" placeholder="Password" defaultValue="admin123" />
          <Button type="submit" className="w-full">
            {t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
