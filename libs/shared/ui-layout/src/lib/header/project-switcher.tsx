'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { useConfig, getAvailableProjects } from '@myorg/shared/util-config';
import { cn } from '@myorg/shared/util-classnames';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorg/shared/ui';

/**
 * ProjectSwitcher — dropdown to switch the active project configuration.
 *
 * Reads the current config via `useConfig()` and calls `switchProject()`
 * when the user selects a different project. The list of available projects
 * comes from `getAvailableProjects()` in the config system.
 *
 * Why `useState` for the project list?
 * - `getAvailableProjects()` is synchronous and cheap.
 * - No need for async data fetching or TanStack Query here.
 */
export function ProjectSwitcher() {
  const { config, switchProject } = useConfig();
  const [open, setOpen] = React.useState(false);
  const projects = React.useMemo(() => getAvailableProjects(), []);

  const handleSelect = React.useCallback(
    (projectId: string) => {
      setOpen(false);
      if (projectId !== config.project.id) {
        // Switching project reloads config; consumer may also refresh the page.
        switchProject(projectId);
      }
    },
    [config.project.id, switchProject]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-sm font-medium text-card-foreground"
          aria-label="Switch project"
        >
          <span className="max-w-[120px] truncate">{config.project.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[160px]">
        {projects.map((projectId) => (
          <DropdownMenuItem
            key={projectId}
            onClick={() => handleSelect(projectId)}
            className={cn(
              'cursor-pointer',
              projectId === config.project.id && 'bg-accent font-medium'
            )}
          >
            <span className="capitalize">{projectId}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
