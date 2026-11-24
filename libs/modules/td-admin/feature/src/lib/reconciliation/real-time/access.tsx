'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@myorg/shared/util-auth';
import { RECONCILIATION_PERMISSIONS } from '../reconciliation.constants';

const LEGACY_RECONCILIATION_VIEW = '0f31469d73c341efb7ad2c1723837ad9';

export function RealTimeAccess({ children }: { children: ReactNode }) {
  const { user, permissions } = useAuth();
  const t = useTranslations('modules.reconciliation');
  if (!user) return null;
  if (!permissions.has(RECONCILIATION_PERMISSIONS.VIEW) && !permissions.has(LEGACY_RECONCILIATION_VIEW)) {
    return <p role="alert" className="text-destructive">{t('realTimeAccessDenied')}</p>;
  }
  return children;
}
