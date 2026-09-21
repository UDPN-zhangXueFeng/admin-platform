'use client';

import * as React from 'react';
import { LogOut, Menu, Settings, Shield, User } from 'lucide-react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { logoutAndRedirect, useAuth } from '@myorg/shared/util-auth';
import { cn } from '@myorg/shared/util-classnames';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorg/shared/ui';

export interface HeaderProps {
  config: ProjectConfig;
  /** Show a hamburger menu button (for mobile sidebar toggle). */
  onMenuToggle?: () => void;
  /** Minimal mode: hides search/notifications to reduce chrome. */
  minimal?: boolean;
  /** Open the change-password dialog (project-specific). */
  onChangePassword?: () => void;
  /**
   * Project-specific logout (e.g. calling the project's own logout API).
   * When provided it fully replaces the default platform logout flow.
   */
  onLogout?: () => void | Promise<void>;
  /**
   * Click handler for the brand block (logo + project name). When omitted
   * the brand stays static decoration (platform default).
   */
  onBrandClick?: () => void;
  /**
   * Hide the "Manage Account" user-menu entry. Opt-in for projects whose
   * baseline user menu only offers Change Password / Log Out.
   */
  hideManageAccount?: boolean;
  /**
   * Opt-in brand mark replacing the default <img src="/logo-icon.svg">.
   * Use an inline component when the mark must track page CSS variables.
  */
  logo?: React.ReactNode;
  /** Hide the config project name when a custom logo includes its own lockup. */
  hideProjectName?: boolean;
  /** Use a 64px header at every breakpoint. */
  compact?: boolean;
  /**
   * Opt-in content rendered inside the right-hand actions area, before
   * the user menu (reserved entry point, e.g. the notification bell).
   * Like the rest of the actions area it is hidden in minimal mode.
   */
  trailing?: React.ReactNode;
}

/**
 * Reusable application header.
 *
 * 1. Mobile menu toggle
 * 2. Logo image / project name
 * 3. Spacer
 * 4. User avatar + display name
 * All interactive elements are keyboard-focusable and include
 */
export function Header({
  config,
  onMenuToggle,
  minimal = false,
  onChangePassword,
  onLogout,
  onBrandClick,
  hideManageAccount,
  logo,
  hideProjectName = false,
  compact = false,
  trailing,
}: HeaderProps) {
  const { user } = useAuth();
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] =
    React.useState(false);

  const handleLogout = React.useCallback(async () => {
    if (onLogout) {
      // Project owns the whole flow (server logout + local clear + redirect).
      await onLogout();
      return;
    }
    // Default flow: local session clear + redirect. Projects with a server
    // logout endpoint pass onLogout to own the whole flow.
    logoutAndRedirect();
  }, [onLogout]);

  const handleLogoutConfirmationOpenChange = React.useCallback(
    (open: boolean) => {
      setIsLogoutConfirmationOpen(open);
    },
    [],
  );
  const brandContent = (
    <>
      {logo ?? (
        <img
          src="/logo-icon.svg"
          alt="Kissen"
          className="h-10 w-[84px] shrink-0 min-[1600px]:h-12 min-[1600px]:w-[104px]"
        />
      )}
      {!hideProjectName && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide text-white sm:text-base">
            {config.project.name}
          </p>
          {config.project.subtitle ? (
            <p className="hidden truncate text-xs text-white/70 sm:block">
              {config.project.subtitle}
            </p>
          ) : null}
        </div>
      )}
    </>
  );

  const brandBlock = onBrandClick ? (
    <button
      type="button"
      onClick={onBrandClick}
      title="Back to portal home"
      aria-label="Back to portal home"
      className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {brandContent}
    </button>
  ) : (
    <div className="flex min-w-0 items-center gap-3">{brandContent}</div>
  );

  return (
    <header
      className={cn(
        'relative isolate overflow-hidden border-b border-black/10 text-white shadow-md shadow-[#5D5AE8]/20',
        compact
          ? 'min-h-[64px] py-2 min-[1600px]:min-h-[64px] min-[1600px]:py-2'
          : 'min-h-16 py-2 min-[1600px]:min-h-20 min-[1600px]:py-3',
        config.layout.header.sticky && 'sticky top-0 z-30',
      )}
    >
      <AnimatedBannerBackground />
      <div className="absolute inset-0 bg-[#171654]/15" aria-hidden="true" />

      <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 min-[1600px]:gap-4 min-[1600px]:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuToggle}
              aria-label="Toggle navigation menu"
              className="text-white/85 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}

          {brandBlock}
        </div>

        {!minimal && (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {trailing != null && trailing}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-auto items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-1.5 py-1.5 text-white hover:bg-white/[0.15] hover:text-white sm:pr-3"
                  aria-label="Open user menu"
                >
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/15">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <span className="hidden text-sm font-medium sm:block">
                    {user?.name ?? 'User'}
                    {user?.userType === 0 && (
                      <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                        Super Admin
                      </span>
                    )}
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="min-w-[220px]">
                {!hideManageAccount && (
                  <DropdownMenuItem className="gap-2">
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    <span>Manage Account</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="gap-2"
                  onClick={onChangePassword}
                  disabled={!onChangePassword}
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-destructive"
                  onClick={() => setIsLogoutConfirmationOpen(true)}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog
              open={isLogoutConfirmationOpen}
              onOpenChange={handleLogoutConfirmationOpenChange}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleLogout}
                  >
                    Log Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </header>
  );
}

/** Decorative SVG background. Its palette is owned by globals.css banner variables. */
function AnimatedBannerBackground() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1600 112"
    >
      <defs>
        <linearGradient id="app-banner-base" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--banner-start)" />
          <stop offset="0.52" stopColor="var(--banner-mid)" />
          <stop offset="1" stopColor="var(--banner-end)" />
        </linearGradient>
        <radialGradient id="app-banner-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--banner-glow)" stopOpacity="0.48" />
          <stop offset="1" stopColor="var(--banner-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="app-banner-highlight" cx="50%" cy="50%" r="50%">
          <stop
            offset="0"
            stopColor="var(--banner-highlight)"
            stopOpacity="0.32"
          />
          <stop
            offset="1"
            stopColor="var(--banner-highlight)"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      <rect width="1600" height="112" fill="url(#app-banner-base)" />
      <ellipse
        className="app-banner-orb-one"
        cx="285"
        cy="18"
        rx="420"
        ry="120"
        fill="url(#app-banner-glow)"
      />
      <ellipse
        className="app-banner-orb-two"
        cx="1270"
        cy="102"
        rx="450"
        ry="128"
        fill="url(#app-banner-highlight)"
      />
      <path
        className="app-banner-wave"
        d="M-160 84C145 59 330 111 600 83C880 55 1035 98 1230 70C1400 47 1580 58 1760 43V112H-160Z"
        fill="var(--banner-wave)"
        opacity="0.24"
      />
    </svg>
  );
}
