'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Module page registry for kissen-gateway-portal.
 *
 * Maps module id + page key → a dynamic import loader from the
 * `@myorg/modules/kissen-gateway/feature` package. All page components are
 * loaded client-side only (ssr: false) via next/dynamic.
 *
 * Page keys per contract §5.2 (✓ = registered):
 *   onboard      : list, create, edit, detail
 *   tx           : list, detail
 *   currencypair : list, detail
 *   lp           : list, detail
 *   rate         : list, detail
 *   user         : list, create, edit, detail
 *   role         : list, create, edit, detail
 *   menu         : list
 *   log          : list
 */
type PageLoader = () => Promise<{ default: ComponentType<unknown> }>;


const pages: Record<string, Record<string, PageLoader>> = {
  onboard: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  tx: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.TxListPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.TxDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  currencypair: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.CurrencypairListPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.CurrencypairDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  lp: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.LpListPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.LpDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  rate: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RateListPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RateDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  user: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  role: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  menu: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.MenuListPage as unknown as ComponentType<unknown>,
      })),
  },
  log: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.LogListPage as unknown as ComponentType<unknown>,
      })),
  },
};

/**
 * Resolve a (module id, page key) pair to a lazily-loaded page component.
 * Returns null when no loader is registered, so the caller can render a
 * "Page Not Found" placeholder instead of throwing.
 */
export function loadKissenGatewayModulePage(
  moduleId: string,
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = pages[moduleId]?.[pageKey];
  if (!loader) return null;
  return dynamic(() => loader(), { ssr: false }) as unknown as ComponentType<unknown>;
}
