import './globals.css';
import type { Metadata } from 'next';
import { loadProjectConfig } from '@myorg/shared/util-config';

/**
 * Metadata is resolved from the project config so <title> and the favicon
 * link stay in sync with configs/kissen-gateway.json (name / favicon).
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await loadProjectConfig();
  return {
    title: config.project.name,
    description: 'Kissen gateway portal — configuration-driven admin shell',
    icons: { icon: config.project.favicon },
  };
}

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
        <ThemeInjector colors={config.theme.colors} radius={config.theme.radius} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

/**
 * Server component that injects a <style> tag to override CSS variables
 * based on the current project's theme.colors and theme.radius.
 *
 * This runs once on the server; the client picks up the values immediately.
 */
function ThemeInjector({
  colors,
  radius,
}: {
  colors: Record<string, string>;
  radius: string;
}) {
  const cssVars = Object.entries(colors)
    .map(([key, value]) => `--${key}: ${value};`)
    .join('\n    ');

  const css = `:root {\n    ${cssVars}\n    --radius: ${radius};\n  }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
