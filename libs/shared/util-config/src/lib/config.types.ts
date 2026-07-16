/**
 * ProjectConfig — the shape of every per-project JSON config in configs/{id}.json.
 *
 * All fields are optional at the JSON level (defaults applied by config.defaults.ts),
 * but the resolved config returned by the loader is always fully typed.
 */

export interface ProjectConfig {
  project: {
    id: string;
    name: string;
    logo: string;
    favicon: string;
  };

  theme: {
    /** "light" | "dark" | "system" */
    mode: string;
    /** CSS-variable-name → HSL value, e.g. { "primary": "241.268 75.532% 63.137%" } (#5D5AE8). */
    colors: Record<string, string>;
    /** e.g. "0.5rem" */
    radius: string;
    fontFamily: {
      sans: string;
      mono: string;
    };
  };

  layout: {
    /** "sidebar" | "top-nav" | "compact" | "dual-panel" */
    type: string;
    sidebar: {
      /** "left" | "right" */
      position: string;
      width: string;
      collapsible: boolean;
      collapsedWidth: string;
      showIconsOnlyCollapsed: boolean;
    };
    header: {
      sticky: boolean;
      showProjectSwitcher: boolean;
      showSearch: boolean;
      showNotifications: boolean;
      showUserMenu: boolean;
    };
    breadcrumb: {
      enabled: boolean;
    };
  };

  modules: {
    enabled: string[];
    order: ModuleMenuItem[];
    dashboard: {
      widgets: DashboardWidget[];
    };
  };

  i18n: {
    defaultLocale: string;
    locales: string[];
    /** project-specific translation key overrides, deep-merged on top of shared messages */
    projectOverrides: Record<string, Record<string, string>>;
  };

  features: {
    darkMode: boolean;
    multiTab: boolean;
    fullscreen: boolean;
    exportCSV: boolean;
    bulkActions: boolean;
  };
}

/** A single menu entry in config.modules.order */
export interface ModuleMenuItem {
  id: string;
  icon: string;
  label: string;
  group?: string;
  /** Explicit nav path. If omitted and no children, falls back to `/{id}`. */
  path?: string;
  /** Whether the item is visually disabled (non-interactive). */
  disabled?: boolean;
  children?: ModuleMenuItem[];
}

/** A dashboard widget descriptor */
export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  span?: number;
  props?: Record<string, unknown>;
}
