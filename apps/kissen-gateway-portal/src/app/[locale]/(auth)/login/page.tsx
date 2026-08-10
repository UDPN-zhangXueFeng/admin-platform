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
 * MOCK Login — sets a fake session cookie and redirects to the dashboard.
 *
 * No real authentication. The cookie name `kissen_gateway_token` must match
 * the middleware check in src/middleware.ts.
 */
export default function LoginRoute() {
  const router = useRouter();
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              document.cookie =
                'kissen_gateway_token=mock-token; path=/; max-age=86400';
            router.replace('/dashboard');
            }}
            className="space-y-4"
          >
            <Input placeholder="Username" defaultValue="admin" />
            <Input
              type="password"
              placeholder="Password"
              defaultValue="admin123"
            />
            <Button type="submit" className="w-full">
              {t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
