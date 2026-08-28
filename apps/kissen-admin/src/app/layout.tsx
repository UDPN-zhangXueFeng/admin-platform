import './globals.css';
import type { Metadata } from 'next';
import { loadProjectConfig } from '@myorg/shared/util-config';

export const metadata: Metadata = {
  title: 'Kissen Admin',
  description: 'Kissen Admin — configuration-driven admin platform',
};

/**
 * Root Layout — the outermost layout required by Next.js App Router.
 *
 * Responsibilities (and ONLY these):
 * 1. Load project config server-side to resolve locale & theme defaults.
 * 2. Set <html lang> from the config's default locale.
 * 3. Inject ThemeInjector as an inline <style> tag with CSS variables
 *    from config.theme.colors — this overrides the defaults in globals.css.
 * 4. Set font class on <body>.
 *
 * No business logic, no module components, no providers.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await loadProjectConfig();

  return (
    <html lang={config.i18n.defaultLocale} suppressHydrationWarning>
      <head>
        <ThemeInjector
          colors={config.theme.colors}
          themes={config.theme.themes}
          defaultTheme={config.theme.defaultTheme}
          radius={config.theme.radius}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

/**
 * Server component that injects the runtime theming layer (LP 06 模式):
 *  1. `:root` baseline from theme.colors (+ the default palette merged in, so
 *     a no-JS first paint already carries brand tokens);
 *  2. one `[data-theme="<id>"]` block per switchable palette from
 *     theme.themes (config-driven — adding/tuning a theme is a configs change);
 *  3. a pre-paint script that restores the locally chosen palette (or the
 *     configured default) onto <html data-theme> to avoid a flash.
 *
 * localStorage key `kissen-admin-theme` 与 feature 侧 ThemeSwitcher 一致，
 * 不与 LP（`lp-theme`）共用。Apps that omit theme.themes keep the legacy
 * single-theme behavior: the script and data-theme blocks simply don't render.
 */
function ThemeInjector({
  colors,
  themes,
  defaultTheme,
  radius,
}: {
  colors: Record<string, string>;
  themes: { id: string; label: string; colors: Record<string, string> }[];
  defaultTheme?: string;
  radius: string;
}) {
  const defaultPalette = themes.find((t) => t.id === defaultTheme);
  const baseline = { ...(defaultPalette?.colors ?? {}), ...colors };

  const toVars = Object.entries(baseline)
    .map(([key, value]) => `--${key}: ${value};`)
    .join('');
  const themeBlocks = themes
    .map(
      (t) =>
        `[data-theme='${t.id}']{${Object.entries(t.colors)
          .map(([key, value]) => `--${key}: ${value};`)
          .join('')}}`,
    )
    .join('');

  const css = `:root{${toVars}--radius:${radius};}${themeBlocks}`;

  const themeIds = themes.map((t) => t.id);
  const restoreScript =
    themes.length > 0
      ? `try{var t=localStorage.getItem('kissen-admin-theme');var ids=${JSON.stringify(themeIds)};${
          defaultTheme ? `var d=${JSON.stringify(defaultTheme)};` : 'var d=null;'
        }t=ids.indexOf(t)>=0?t:d;if(t)document.documentElement.dataset.theme=t;}catch(e){}`
      : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {restoreScript && (
        <script dangerouslySetInnerHTML={{ __html: restoreScript }} />
      )}
    </>
  );
}
