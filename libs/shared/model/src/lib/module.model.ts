/**
 * ModuleManifest — the "identity card" every module exposes.
 *
 * Each module declares one of these in its feature/lib/module-manifest.ts.
 * The module-registry reads manifests to build menus, routes, and permission checks.
 */

export interface ModuleManifest {
  /** Unique module identifier, e.g. "user", "order" */
  id: string;
  /** Display name shown in sidebar / breadcrumb */
  name: string;
  /** Lucide icon name, e.g. "Users", "ShoppingCart" */
  icon: string;
  /** Routes the module provides */
  routes: ModuleRoute[];
  /** Permission strings required to access the module, e.g. ["user:read"] */
  permissions: string[];
  /** i18n namespace, e.g. "modules.user" */
  i18nNamespace: string;
}

/** A single route exposed by a module. */
export interface ModuleRoute {
  /** URL pattern, e.g. "/user", "/user/:id" */
  path: string;
  /** Component key to load from the module's pages, e.g. "list", "detail", "create" */
  component: string;
  /** Human-readable label for breadcrumbs / menus */
  label: string;
  /** Optional permission required for this specific route */
  permission?: string;
}
