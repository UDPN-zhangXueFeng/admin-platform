'use client';

/**
 * UI settings page (registry: /system/ui -> SystemUiPage; export name is fixed).
 *
 * The brand customization form lives in brand-customization-card.tsx; this
 * module keeps the page wrapper and data query only.
 */
import {
  KISSEN_GATEWAY_PROJECT_ID,
  useBrandQuery,
} from '@myorg/modules/kissen-gateway/data-access';

import { BrandCustomizationCard } from './brand-customization-card';
import { PageHead } from './page-head';

export function SystemUiPage() {
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);

  return (
    <div className="space-y-4">
      <PageHead title="UI Setting" />
      <BrandCustomizationCard brand={brand} />
    </div>
  );
}
