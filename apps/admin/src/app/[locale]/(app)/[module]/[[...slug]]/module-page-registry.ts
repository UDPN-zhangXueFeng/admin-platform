'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const spAccessPages: Record<
  string,
  () => Promise<{ default: ComponentType<unknown> }>
> = {
  list: () =>
    import('@myorg/modules/sp-access/feature').then((m) => ({
      default: m.SpAccessListPage as unknown as ComponentType<unknown>,
    })),
  create: () =>
    import('@myorg/modules/sp-access/feature').then((m) => ({
      default: m.SpAccessFormPage as unknown as ComponentType<unknown>,
    })),
  edit: () =>
    import('@myorg/modules/sp-access/feature').then((m) => ({
      default: m.SpAccessFormPage as unknown as ComponentType<unknown>,
    })),
  detail: () =>
    import('@myorg/modules/sp-access/feature').then((m) => ({
      default: m.SpAccessDetailPage as unknown as ComponentType<unknown>,
    })),
};

const keyManagementPages: Record<
  string,
  () => Promise<{ default: ComponentType<unknown> }>
> = {
  'key-service-configuration': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeyServiceConfigurationListPage as unknown as ComponentType<unknown>,
    })),
  'key-signed-transactions': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeySignedTransactionsListPage as unknown as ComponentType<unknown>,
    })),
  'managed-wallets': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.ManagedWalletsListPage as unknown as ComponentType<unknown>,
    })),
  'managed-wallets-detail': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.ManagedWalletsDetailPage as unknown as ComponentType<unknown>,
    })),
  'user-wallets': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.UserWalletsListPage as unknown as ComponentType<unknown>,
    })),
  'key-policy-configuration': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeyPolicyConfigurationListPage as unknown as ComponentType<unknown>,
    })),
  'key-policy-configuration-new': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeyPolicyConfigurationNewPage as unknown as ComponentType<unknown>,
    })),
  'key-policy-configuration-edit': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeyPolicyConfigurationEditPage as unknown as ComponentType<unknown>,
    })),
  'key-policy-configuration-detail': () =>
    import('@myorg/modules/key-management/feature').then((m) => ({
      default:
        m.KeyPolicyConfigurationDetailPage as unknown as ComponentType<unknown>,
    })),
};

export function loadSpAccessModulePage(
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = spAccessPages[pageKey];
  if (!loader) return null;

  return dynamic(() => loader(), {
    ssr: false,
  }) as unknown as ComponentType<unknown>;
}

export function loadKeyManagementModulePage(
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = keyManagementPages[pageKey];
  if (!loader) return null;

  return dynamic(() => loader(), {
    ssr: false,
  }) as unknown as ComponentType<unknown>;
}
