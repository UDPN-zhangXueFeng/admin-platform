import { z } from 'zod';

/**
 * Helper: make a schema optional with a lazy default that parses an empty object.
 * This works around Zod v4's strict `.default()` type inference where `{}` doesn't
 * satisfy the input type of schemas with non-optional fields that have `.default()`.
 */
function withDefault<T extends z.ZodTypeAny>(schema: T) {
  return z.optional(schema).transform((val) => val ?? schema.parse({}));
}

const projectSchema = z.object({
  id: z.string().default('ecommerce'),
  name: z.string().default('Admin Platform'),
  // Historical header subtitle; kept as the default so existing projects
  // render exactly what the shared Header hardcoded before this field existed.
  subtitle: z.string().default('Stablecoin Management System'),
  logo: z.string().default('/logo.svg'),
  favicon: z.string().default('/favicon.ico'),
});

const fontFamilySchema = z.object({
  sans: z.string().default('Inter, system-ui, sans-serif'),
  mono: z.string().default('JetBrains Mono, monospace'),
});

const themeSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('system'),
  colors: z.record(z.string(), z.string()).default({}),
  radius: z.string().default('0.5rem'),
  fontFamily: withDefault(fontFamilySchema),
});

const sidebarSchema = z.object({
  position: z.enum(['left', 'right']).default('left'),
  width: z.string().default('260px'),
  collapsible: z.boolean().default(true),
  collapsedWidth: z.string().default('68px'),
  showIconsOnlyCollapsed: z.boolean().default(true),
  singleExpand: z.boolean().default(false),
});

const headerSchema = z.object({
  sticky: z.boolean().default(true),
  showProjectSwitcher: z.boolean().default(true),
  showSearch: z.boolean().default(true),
  showNotifications: z.boolean().default(true),
  showUserMenu: z.boolean().default(true),
});

const breadcrumbSchema = z.object({
  enabled: z.boolean().default(true),
});

const layoutSchema = z.object({
  type: z.enum(['sidebar', 'top-nav', 'compact', 'dual-panel']).default('sidebar'),
  sidebar: withDefault(sidebarSchema),
  header: withDefault(headerSchema),
  breadcrumb: withDefault(breadcrumbSchema),
});

const menuItemSchema = z.object({
  id: z.string(),
  icon: z.string().default('Box'),
  label: z.string(),
  group: z.string().optional(),
  path: z.string().optional(),
  disabled: z.boolean().optional(),
  children: z
    .array(
      z.object({
        id: z.string(),
        icon: z.string().default('Box'),
        label: z.string(),
        group: z.string().optional(),
        path: z.string().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
});

const dashboardSchema = z.object({
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      span: z.number().optional(),
      props: z.record(z.string(), z.unknown()).optional(),
    }),
  ).default([]),
});

const modulesSchema = z.object({
  enabled: z.array(z.string()).default([]),
  order: z.array(menuItemSchema).default([]),
  dashboard: withDefault(dashboardSchema),
});

const i18nSchema = z.object({
  defaultLocale: z.string().default('en-US'),
  locales: z.array(z.string()).default(['en-US', 'zh-CN']),
  projectOverrides: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

const featuresSchema = z.object({
  darkMode: z.boolean().default(true),
  multiTab: z.boolean().default(false),
  fullscreen: z.boolean().default(true),
  exportCSV: z.boolean().default(true),
  bulkActions: z.boolean().default(true),
  inactivityLogout: z.boolean().default(false),
});

/** Zod schema matching ProjectConfig. All fields optional with sensible defaults. */
export const ProjectConfigSchema = z.object({
  project: withDefault(projectSchema),
  theme: withDefault(themeSchema),
  layout: withDefault(layoutSchema),
  modules: withDefault(modulesSchema),
  i18n: withDefault(i18nSchema),
  features: withDefault(featuresSchema),
});
