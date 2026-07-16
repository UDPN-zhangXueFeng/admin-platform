/**
 * Auth Layout — minimal layout for unauthenticated pages (login, etc.).
 *
 * No sidebar or header. Auth features own their full-page presentation.
 * Shared providers (i18n, config, query, auth) come from the parent [locale] layout.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen bg-background">{children}</main>;
}
