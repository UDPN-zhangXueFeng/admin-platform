'use client';

import * as React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';

export interface NavbarProps {
  title?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  showUserMenu?: boolean;
  searchSlot?: React.ReactNode;
  userSlot?: React.ReactNode;
  className?: string;
}

/**
 * Top application navbar.
 *
 * Layout (left-to-right):
 * 1. Logo / title area
 * 2. Optional search slot (or default search icon placeholder)
 * 3. Notification bell
 * 4. User avatar / menu
 *
 * All interactive elements are keyboard-focusable and include
 * `aria-label` for screen-reader context.
 */
export function Navbar({
  title,
  showSearch = true,
  showNotifications = true,
  showUserMenu = true,
  searchSlot,
  userSlot,
  className,
}: NavbarProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b bg-card px-4',
        className
      )}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-lg font-semibold text-card-foreground">
            {title}
          </h1>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {showSearch && (
          <div className="flex items-center">
            {searchSlot ?? (
              <button
                type="button"
                aria-label="Search"
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-md',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {showNotifications && (
          <button
            type="button"
            aria-label="Notifications"
            className={cn(
              'relative inline-flex h-9 w-9 items-center justify-center rounded-md',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {/* Unread indicator placeholder */}
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
        )}

        {showUserMenu && (
          <div className="flex items-center">
            {userSlot ?? (
              <button
                type="button"
                aria-label="User menu"
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-full',
                  'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
