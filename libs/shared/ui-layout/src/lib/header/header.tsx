'use client';

import * as React from 'react';
import {
  Bell,
  LogOut,
  Menu,
  PanelLeft,
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
  /** Show a desktop sidebar collapse/expand toggle. */
  onSidebarToggle?: () => void;
  /** Minimal mode: hides search/notifications to reduce chrome. */
  minimal?: boolean;
}

/**
 * Reusable application header.
 *
 * Layout (left-to-right):
 * 1. Sidebar toggle (desktop) + Mobile menu toggle
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
  onSidebarToggle,
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
        'flex h-14 items-center justify-between border-b bg-card px-4',
        config.layout.header.sticky && 'sticky top-0 z-30'
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        {onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}

        {/* Desktop sidebar collapse / expand */}
        {onSidebarToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar"
            className="hidden lg:inline-flex"
          >
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}

        {/* Logo / project name */}
        <div className="flex items-center gap-2">
          {config.project.logo && (
            <img
              src={config.project.logo}
              alt=""
              className="h-6 w-6"
              aria-hidden="true"
            />
          )}
          <span className="text-base font-semibold text-card-foreground">
            {config.project.name}
          </span>
        </div>
      </div>

      {/* Right section — actions */}
      {!minimal && (
        <div className="flex items-center gap-4">
          {/* Docs links */}
          <a
            href="#"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            User Manual
          </a>
          <a
            href="#"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            API Documentation
          </a>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {/* Notification count badge */}
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              21
            </span>
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto items-center gap-2 px-2 py-1.5"
                aria-label="Open user menu"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-primary" aria-hidden="true" />
                  )}
                </div>
                <span className="hidden text-sm font-medium text-card-foreground md:block">
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
              <DropdownMenuItem className="gap-2 text-destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
