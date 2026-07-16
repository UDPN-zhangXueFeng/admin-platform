'use client';

import * as React from 'react';
import {
  Bell,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { logoutAndRedirect, useAuth } from '@myorg/shared/util-auth';
import { cn } from '@myorg/shared/util-classnames';
import { logoutApi } from '@myorg/modules/auth/data-access';
import {
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
}

/**
 * Reusable application header.
 *
 * Layout (left-to-right):
 * 1. Mobile menu toggle
 * 2. Logo / project name
 * 3. Spacer
 * 4. User Manual link
 * 5. API Documentation link
 * 6. Notifications bell (with count badge)
 * 7. User avatar + display name
 *
 * All interactive elements are keyboard-focusable and include
 * `aria-label` for screen-reader context.
 */
export function Header({
  config,
  onMenuToggle,
  minimal = false,
}: HeaderProps) {
  const { user } = useAuth();

  const handleLogout = React.useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Local logout must still complete even if the server session is already invalid.
    } finally {
      logoutAndRedirect();
    }
  }, []);

  return (
    <header
      className={cn(
        'relative isolate overflow-hidden border-b border-black/10 text-white shadow-md shadow-[#5D5AE8]/20',
        config.layout.header.sticky && 'sticky top-0 z-30',
      )}
    >
      <AnimatedBannerBackground />
      <div className="absolute inset-0 bg-[#171654]/15" aria-hidden="true" />

      <div className="relative flex min-h-20 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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

          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo-icon.svg"
              alt="UDPN"
              className="h-12 w-[104px] shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide text-white sm:text-base">
                {config.project.name}
              </p>
              <p className="hidden truncate text-xs text-white/70 sm:block">
                Stablecoin Management System
              </p>
            </div>
          </div>
        </div>

        {!minimal && (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="#"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:block"
            >
              User Manual
            </a>
            <a
              href="#"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white md:block"
            >
              API Documentation
            </a>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative rounded-full border border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.15] hover:text-white"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                21
              </span>
            </Button>

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
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <span>Manage Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
