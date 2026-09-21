import { loadProjectConfig } from '@myorg/shared/util-config';
import { KissenAppShell } from './kissen-app-shell';


/**
 * App Layout — wraps authenticated routes with AppShell (sidebar + header).
 *
 * All business module pages live under this route group.
 * Config is loaded here to avoid re-fetching in every child layout.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await loadProjectConfig();

  return <KissenAppShell config={config}>{children}</KissenAppShell>;
}
