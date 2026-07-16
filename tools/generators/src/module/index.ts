import {
  type Tree,
  type GeneratorCallback,
  formatFiles,
  readJson,
  writeJson,
} from '@nx/devkit';
import { join } from 'path';

interface ModuleGeneratorSchema {
  name: string;
  displayName?: string;
  icon?: string;
}

/**
 * Nx generator that scaffolds a full domain module with the standard
 * four-layer architecture: feature / ui / data-access / util.
 *
 * Conventions enforced:
 * - project.json names follow `modules-{name}-{layer}`
 * - Nx tags are `scope:{name}` and `type:{layer}`
 * - Barrel files live at `src/index.ts`
 * - TanStack Query keys/queries/mutations are co-located in `+queries/`
 * - Zustand UI state lives in `+state/`
 * - tsconfig.base.json paths are automatically registered
 */
export default async function moduleGenerator(
  tree: Tree,
  options: ModuleGeneratorSchema
): Promise<GeneratorCallback> {
  const { name } = options;
  const displayName = options.displayName ?? name;
  const icon = options.icon ?? 'FileText';

  const pascal = toPascal(name);
  const camel = toCamel(name);
  const base = `libs/modules/${name}`;

  // ── 1. project.json for each layer ──────────────────────────────────
  const layers: Array<{ dir: string; type: string }> = [
    { dir: 'feature', type: 'feature' },
    { dir: 'ui', type: 'ui' },
    { dir: 'data-access', type: 'data-access' },
    { dir: 'util', type: 'util' },
  ];

  for (const layer of layers) {
    const projectRoot = join(base, layer.dir);
    const projectName = `modules-${name}-${layer.dir}`;

    tree.write(
      join(projectRoot, 'project.json'),
      JSON.stringify(
        {
          name: projectName,
          $schema: '../../../node_modules/nx/schemas/project-schema.json',
          sourceRoot: `${projectRoot}/src`,
          projectType: 'library',
          tags: [`scope:${name}`, `type:${layer.type}`],
          targets: {
            lint: {
              executor: '@nx/eslint:lint',
              outputs: ['{options.outputFile}'],
            },
            test: {
              executor: '@nx/jest:jest',
              outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
              options: {
                jestConfig: `${projectRoot}/jest.config.ts`,
                passWithNoTests: true,
              },
            },
          },
        },
        null,
        2
      )
    );
  }

  // ── 2. util layer ───────────────────────────────────────────────────
  tree.write(
    join(base, 'util/src/index.ts'),
    `export {
  ${camel.toUpperCase()}_PERMISSIONS,
  ALL_${camel.toUpperCase()}_PERMISSIONS,
  has${pascal}Permission,
} from './lib/${name}-permissions';
export type { ${pascal}Permission } from './lib/${name}-permissions';

export type { ${pascal}Role, ${pascal}Status, ${pascal}Filters } from './lib/${name}-types';

export {
  create${pascal}Schema,
  update${pascal}Schema,
} from './lib/${name}-validation';
export type {
  Create${pascal}FormValues,
  Update${pascal}FormValues,
} from './lib/${name}-validation';
`
  );

  tree.write(
    join(base, `util/src/lib/${name}-permissions.ts`),
    `/**
 * ${displayName} module permission constants and helpers.
 *
 * Centralising permission strings prevents typos that would silently
 * break PermissionGuard or usePermission checks.
 */

export const ${camel.toUpperCase()}_PERMISSIONS = {
  READ: '${name}:read',
  WRITE: '${name}:write',
  DELETE: '${name}:delete',
  ADMIN: '${name}:admin',
} as const;

export type ${pascal}Permission =
  | '${name}:read'
  | '${name}:write'
  | '${name}:delete'
  | '${name}:admin';

/** Convenience set for quick reference or iteration. */
export const ALL_${camel.toUpperCase()}_PERMISSIONS: ${pascal}Permission[] = [
  ${camel.toUpperCase()}_PERMISSIONS.READ,
  ${camel.toUpperCase()}_PERMISSIONS.WRITE,
  ${camel.toUpperCase()}_PERMISSIONS.DELETE,
  ${camel.toUpperCase()}_PERMISSIONS.ADMIN,
];

/**
 * Check whether a permission list contains the given ${name} permission.
 *
 * @param permissions — current user's permission set
 * @param required — permission to test
 */
export function has${pascal}Permission(
  permissions: string[] | undefined,
  required: ${pascal}Permission
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(required);
}
`
  );

  tree.write(
    join(base, `util/src/lib/${name}-types.ts`),
    `/**
 * ${displayName} module primitive types.
 *
 * Placed in \`util\` so that \`ui\` and \`util\` can both import them
 * without violating module-boundary rules.
 */

/** Supported ${name} roles. */
export type ${pascal}Role = 'admin' | 'manager' | 'editor' | 'viewer';

/** Supported ${name} statuses. */
export type ${pascal}Status = 'active' | 'inactive' | 'pending';

/** Client-side filter state — mirrors API params but is UI-owned. */
export interface ${pascal}Filters {
  search: string;
  role: ${pascal}Role | 'all';
  status: ${pascal}Status | 'all';
}
`
  );

  tree.write(
    join(base, `util/src/lib/${name}-validation.ts`),
    `/**
 * ${displayName} module Zod schemas.
 *
 * These schemas are consumed by react-hook-form via \`@hookform/resolvers/zod\`
 * and can also be reused for runtime payload validation before API calls.
 */

import { z } from 'zod';
import type { ${pascal}Role, ${pascal}Status } from './${name}-types';

const ${camel}RoleSchema = z.enum(['admin', 'manager', 'editor', 'viewer'] as const satisfies readonly ${pascal}Role[]);

const ${camel}StatusSchema = z.enum(['active', 'inactive', 'pending'] as const satisfies readonly ${pascal}Status[]);

export const create${pascal}Schema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  role: ${camel}RoleSchema,
  status: ${camel}StatusSchema.optional().default('active'),
});

export const update${pascal}Schema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  role: ${camel}RoleSchema.optional(),
  status: ${camel}StatusSchema.optional(),
});

export type Create${pascal}FormValues = z.infer<typeof create${pascal}Schema>;
export type Update${pascal}FormValues = z.infer<typeof update${pascal}Schema>;
`
  );

  // ── 3. data-access layer ────────────────────────────────────────────
  tree.write(
    join(base, 'data-access/src/index.ts'),
    `export type {
  ${pascal},
  ${pascal}Role,
  ${pascal}Status,
  Create${pascal}DTO,
  Update${pascal}DTO,
  ${pascal}ListParams,
  ${pascal}Filters,
} from './lib/${name}.model';

export {
  get${pascal}s,
  get${pascal},
  create${pascal},
  update${pascal},
  delete${pascal},
} from './lib/${name}.api';

export { ${camel}Keys } from './lib/+queries/${name}.keys';
export { use${pascal}sQuery, use${pascal}Query } from './lib/+queries/${name}.queries';
export {
  useCreate${pascal}Mutation,
  useUpdate${pascal}Mutation,
  useDelete${pascal}Mutation,
} from './lib/+queries/${name}.mutations';

export { use${pascal}UiStore } from './lib/+state/${name}-ui.store';
`
  );

  tree.write(
    join(base, `data-access/src/lib/${name}.model.ts`),
    `/**
 * ${displayName} module domain model — types, DTOs, and filter shapes.
 *
 * Kept strictly decoupled from UI or networking concerns so both
 * feature pages and API layers can import without pulling React.
 */

import type { PaginationParams } from '@myorg/shared/model';
import type { ${pascal}Role, ${pascal}Status, ${pascal}Filters } from '@myorg/modules/${name}/util';

export type { ${pascal}Role, ${pascal}Status, ${pascal}Filters };

/** Core ${name} entity returned by the API. */
export interface ${pascal} {
  id: string;
  name: string;
  email: string;
  role: ${pascal}Role;
  status: ${pascal}Status;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a new ${name}. */
export interface Create${pascal}DTO {
  name: string;
  email: string;
  role: ${pascal}Role;
  status?: ${pascal}Status;
  avatar?: string;
}

/** Payload for updating an existing ${name}. */
export interface Update${pascal}DTO {
  name?: string;
  email?: string;
  role?: ${pascal}Role;
  status?: ${pascal}Status;
  avatar?: string;
}

/** Query parameters sent to the paginated ${name} list endpoint. */
export interface ${pascal}ListParams extends PaginationParams {
  /** Free-text search across name and email */
  search?: string;
  /** Filter by role */
  role?: ${pascal}Role;
  /** Filter by status */
  status?: ${pascal}Status;
}
`
  );

  tree.write(
    join(base, `data-access/src/lib/${name}.api.ts`),
    `/**
 * ${displayName} module raw API layer.
 *
 * Thin wrappers around Axios that map to CRUD endpoints.
 * No caching, no UI state — just HTTP + types.
 */

import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type { ${pascal}, ${pascal}ListParams, Create${pascal}DTO, Update${pascal}DTO } from './${name}.model';

export function get${pascal}s(
  params: ${pascal}ListParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<${pascal}>> {
  return apiClient.get('/${name}s', { ...config, params });
}

export function get${pascal}(id: string, config?: ApiRequestConfig): Promise<${pascal}> {
  return apiClient.get(\`/${name}s/\${id}\`, config);
}

export function create${pascal}(data: Create${pascal}DTO): Promise<${pascal}> {
  return apiClient.post('/${name}s', data);
}

export function update${pascal}(id: string, data: Update${pascal}DTO): Promise<${pascal}> {
  return apiClient.patch(\`/${name}s/\${id}\`, data);
}

export function delete${pascal}(id: string): Promise<void> {
  return apiClient.delete(\`/${name}s/\${id}\`);
}
`
  );

  tree.write(
    join(base, `data-access/src/lib/+queries/${name}.keys.ts`),
    `/**
 * TanStack Query key factory for the ${name} module.
 *
 * Every key includes \`projectId\` so switching projects automatically
 * isolates cached server-state. Always use these helpers instead of
 * inline string arrays.
 */

import type { ${pascal}ListParams } from '../${name}.model';

export const ${camel}Keys = {
  /** Root key for all ${name} queries within a project. */
  all: (projectId: string) => ['project', projectId, '${name}'] as const,

  /** Key prefix for all list queries. */
  lists: (projectId: string) => [...${camel}Keys.all(projectId), 'list'] as const,

  /** Key for a specific paginated/filtered list. */
  list: (projectId: string, params: ${pascal}ListParams) =>
    [...${camel}Keys.lists(projectId), params] as const,

  /** Key prefix for all detail queries. */
  details: (projectId: string) => [...${camel}Keys.all(projectId), 'detail'] as const,

  /** Key for a single ${name} detail. */
  detail: (projectId: string, id: string) =>
    [...${camel}Keys.details(projectId), id] as const,
};
`
  );

  tree.write(
    join(base, `data-access/src/lib/+queries/${name}.queries.ts`),
    `'use client';

/**
 * ${displayName} module read-query hooks.
 *
 * All hooks accept \`projectId\` as the first argument so query keys
 * stay isolated across project switches. TanStack Query owns the
 * server-state; these hooks merely bridge API calls with cache keys.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { get${pascal}, get${pascal}s } from '../${name}.api';
import type { ${pascal}ListParams } from '../${name}.model';
import { ${camel}Keys } from './${name}.keys';

export function use${pascal}sQuery(projectId: string, params: ${pascal}ListParams) {
  return useQuery({
    queryKey: ${camel}Keys.list(projectId, params),
    queryFn: ({ signal }) => get${pascal}s(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function use${pascal}Query(projectId: string, id: string) {
  return useQuery({
    queryKey: ${camel}Keys.detail(projectId, id),
    queryFn: ({ signal }) => get${pascal}(id, { signal }),
    enabled: Boolean(id),
  });
}
`
  );

  tree.write(
    join(base, `data-access/src/lib/+queries/${name}.mutations.ts`),
    `'use client';

/**
 * ${displayName} module mutation hooks.
 *
 * On success each mutation invalidates the minimal query-key subtree
 * so that lists auto-refresh while preserving unrelated caches.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { create${pascal}, delete${pascal}, update${pascal} } from '../${name}.api';
import type { Create${pascal}DTO, Update${pascal}DTO } from '../${name}.model';
import { ${camel}Keys } from './${name}.keys';

export function useCreate${pascal}Mutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Create${pascal}DTO) => create${pascal}(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${camel}Keys.lists(projectId) });
    },
  });
}

export function useUpdate${pascal}Mutation(projectId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Update${pascal}DTO) => update${pascal}(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${camel}Keys.detail(projectId, id) });
      queryClient.invalidateQueries({ queryKey: ${camel}Keys.lists(projectId) });
    },
  });
}

export function useDelete${pascal}Mutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => delete${pascal}(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${camel}Keys.lists(projectId) });
    },
  });
}
`
  );

  tree.write(
    join(base, `data-access/src/lib/+state/${name}-ui.store.ts`),
    `'use client';

/**
 * ${displayName} module UI-state store (Zustand).
 *
 * Manages purely client-side UI concerns: multi-select row IDs,
 * dialog visibility, and panel toggles. NEVER stores API data here —
 * that belongs to TanStack Query.
 */

import { createUIStore } from '@myorg/shared/util-state';

interface ${pascal}UiState {
  /** IDs of currently selected ${name}s (e.g. for bulk actions). */
  selected${pascal}Ids: string[];
  /** Whether the "create ${name}" dialog is open. */
  isCreateDialogOpen: boolean;
  /** Whether the filter panel is expanded. */
  isFilterPanelOpen: boolean;

  setSelected${pascal}Ids: (ids: string[]) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;

  /** Convenience: toggle a single ID in the selection set. */
  toggle${pascal}Selection: (id: string) => void;
  /** Convenience: clear all selections. */
  clearSelection: () => void;
}

export const use${pascal}UiStore = createUIStore<${pascal}UiState>(
  (set) => ({
    selected${pascal}Ids: [],
    isCreateDialogOpen: false,
    isFilterPanelOpen: false,

    setSelected${pascal}Ids: (ids) => set({ selected${pascal}Ids: ids }),
    setCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
    setFilterPanelOpen: (open) => set({ isFilterPanelOpen: open }),

    toggle${pascal}Selection: (id) =>
      set((state) => ({
        selected${pascal}Ids: state.selected${pascal}Ids.includes(id)
          ? state.selected${pascal}Ids.filter((x) => x !== id)
          : [...state.selected${pascal}Ids, id],
      })),

    clearSelection: () => set({ selected${pascal}Ids: [] }),
  }),
  '${pascal}UiStore'
);
`
  );

  // ── 4. ui layer ─────────────────────────────────────────────────────
  tree.write(
    join(base, 'ui/src/index.ts'),
    `export { ${pascal}Avatar, type ${pascal}AvatarProps } from './lib/${name}-avatar';
export { ${pascal}StatusBadge, type ${pascal}StatusBadgeProps } from './lib/${name}-status-badge';
export { ${pascal}RoleSelector, type ${pascal}RoleSelectorProps } from './lib/${name}-role-selector';
`
  );

  tree.write(
    join(base, `ui/src/lib/${name}-avatar.tsx`),
    `'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@myorg/shared/util-classnames';

export interface ${pascal}AvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
}

/**
 * ${displayName} avatar with fallback initials.
 *
 * Uses Radix Avatar for robust image-loading and fallback behaviour.
 */
export function ${pascal}Avatar({ name, avatar, className }: ${pascal}AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
    >
      <AvatarPrimitive.Image
        src={avatar ?? undefined}
        alt={name}
        className="aspect-square h-full w-full"
      />
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
`
  );

  tree.write(
    join(base, `ui/src/lib/${name}-status-badge.tsx`),
    `'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';
import type { ${pascal}Status } from '@myorg/modules/${name}/util';

const statusVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      } as Record<${pascal}Status, string>,
    },
    defaultVariants: {
      status: 'pending',
    },
  }
);

export interface ${pascal}StatusBadgeProps extends VariantProps<typeof statusVariants> {
  status: ${pascal}Status;
  className?: string;
}

/**
 * Visual status badge for ${displayName} entities.
 *
 * Maps each ${pascal}Status to a colour-coded pill. Dark-mode colours
 * are included so the badge works across themes without extra props.
 */
export function ${pascal}StatusBadge({ status, className }: ${pascal}StatusBadgeProps) {
  const labels: Record<${pascal}Status, string> = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
  };

  return (
    <span className={cn(statusVariants({ status }), className)}>
      {labels[status]}
    </span>
  );
}
`
  );

  tree.write(
    join(base, `ui/src/lib/${name}-role-selector.tsx`),
    `'use client';

import * as React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@myorg/shared/ui';
import type { ${pascal}Role } from '@myorg/modules/${name}/util';

export interface ${pascal}RoleSelectorProps {
  value: ${pascal}Role;
  onChange: (value: ${pascal}Role) => void;
  disabled?: boolean;
}

const roles: { value: ${pascal}Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

/**
 * Dropdown selector for ${displayName} roles.
 *
 * Wraps the shared Select component and hard-codes the role list
 * so callers don't need to repeat it in every form.
 */
export function ${pascal}RoleSelector({ value, onChange, disabled }: ${pascal}RoleSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
`
  );

  // ── 5. feature layer ────────────────────────────────────────────────
  tree.write(
    join(base, 'feature/src/index.ts'),
    `export { manifest } from './lib/module-manifest';
export { ${pascal}ListPage } from './lib/${name}-list-page';
export { ${pascal}DetailPage } from './lib/${name}-detail-page';
`
  );

  tree.write(
    join(base, 'feature/src/lib/module-manifest.ts'),
    `import type { ModuleManifest } from '@myorg/shared/model';

/**
 * ${displayName} module manifest — the module's "identity card".
 *
 * Declares routes, permissions, and metadata so the app shell
 * can register the module dynamically without hard-coding
 * ${name}-specific logic in apps/admin.
 */
export const manifest: ModuleManifest = {
  id: '${name}',
  name: '${displayName}',
  icon: '${icon}',
  routes: [
    { path: '/${name}', component: 'list', label: '${displayName}列表' },
    { path: '/${name}/:id', component: 'detail', label: '${displayName}详情' },
  ],
  permissions: ['${name}:read', '${name}:write', '${name}:delete'],
  i18nNamespace: 'modules.${name}',
};
`
  );

  tree.write(
    join(base, `feature/src/lib/${name}-list-page.tsx`),
    `'use client';

/**
 * ${pascal}ListPage — paginated ${displayName} list with search, filters, and bulk selection.
 *
 * Architecture:
 * - Server-state (list data)    → TanStack Query via use${pascal}sQuery
 * - Client-state (filters)      → Zustand via use${pascal}UiStore
 * - Table rendering             → shared DataTable
 * - Permission-gated actions    → PermissionGuard / usePermission
 */

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Filter, Trash2 } from 'lucide-react';

import { Button } from '@myorg/shared/ui';
import { DataTable, DataTablePagination } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';

import {
  use${pascal}sQuery,
  useDelete${pascal}Mutation,
  use${pascal}UiStore,
  type ${pascal},
  type ${pascal}ListParams,
} from '@myorg/modules/${name}/data-access';

import {
  ${pascal}Avatar,
  ${pascal}StatusBadge,
  ${pascal}RoleSelector,
} from '@myorg/modules/${name}/ui';

import { ${camel.toUpperCase()}_PERMISSIONS } from '@myorg/modules/${name}/util';

const defaultParams: ${pascal}ListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function ${pascal}ListPage() {
  const router = useRouter();
  const t = useTranslations('modules.${name}');
  const projectId = 'default'; // In real app, from ConfigProvider

  const [params, setParams] = React.useState<${pascal}ListParams>(defaultParams);
  const { selected${pascal}Ids, setSelected${pascal}Ids, setCreateDialogOpen } = use${pascal}UiStore();

  const { data, isLoading, isError } = use${pascal}sQuery(projectId, params);
  const deleteMutation = useDelete${pascal}Mutation(projectId);

  const items = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const handleSearch = React.useCallback((term: string) => {
    setParams((prev) => ({ ...prev, page: 1, search: term || undefined }));
  }, []);

  const handleDelete = React.useCallback(
    (id: string) => {
      if (!window.confirm(t('confirmDelete'))) return;
      deleteMutation.mutate(id);
    },
    [deleteMutation, t]
  );

  const columns = React.useMemo<ColumnDef<${pascal}>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <${pascal}Avatar name={row.original.name} avatar={row.original.avatar} />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: t('email'),
      },
      {
        accessorKey: 'role',
        header: t('role'),
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ row }) => <${pascal}StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createdAt',
        header: t('createdAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('actions'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(\`/${name}/\${row.original.id}\`)}
            >
              {t('view')}
            </Button>
            <PermissionGuard permission={${camel.toUpperCase()}_PERMISSIONS.DELETE}>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t('delete')}
              </Button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [router, handleDelete, t]
  );

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        {t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder={t('searchPlaceholder')}
              className="h-10 rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <PermissionGuard permission={${camel.toUpperCase()}_PERMISSIONS.WRITE}>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        </PermissionGuard>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage={t('empty')}
        pagination={
          paginationMeta
            ? {
                page: paginationMeta.page,
                pageSize: paginationMeta.pageSize,
                total: paginationMeta.total,
                onPageChange: (page) => setParams((prev) => ({ ...prev, page })),
              }
            : undefined
        }
        selection={{
          selectedIds: selected${pascal}Ids,
          onSelectionChange: setSelected${pascal}Ids,
        }}
      />
    </div>
  );
}
`
  );

  tree.write(
    join(base, `feature/src/lib/${name}-detail-page.tsx`),
    `'use client';

/**
 * ${pascal}DetailPage — read-only ${displayName} display with edit / delete actions.
 *
 * Fetches a single ${name} via use${pascal}Query. Falls back to a loading
 * skeleton and surfaces errors inline. Permission-gated actions
 * ensure buttons are hidden when the user lacks rights.
 */

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@myorg/shared/ui';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';

import {
  use${pascal}Query,
  useDelete${pascal}Mutation,
} from '@myorg/modules/${name}/data-access';
import { ${pascal}Avatar, ${pascal}StatusBadge } from '@myorg/modules/${name}/ui';
import { ${camel.toUpperCase()}_PERMISSIONS } from '@myorg/modules/${name}/util';

interface ${pascal}DetailPageProps {
  projectId: string;
  ${camel}Id: string;
}

export function ${pascal}DetailPage({ projectId, ${camel}Id }: ${pascal}DetailPageProps) {
  const router = useRouter();
  const t = useTranslations('modules.${name}');

  const { data: item, isLoading, isError } = use${pascal}Query(projectId, ${camel}Id);
  const deleteMutation = useDelete${pascal}Mutation(projectId);

  const handleDelete = React.useCallback(() => {
    if (!item) return;
    if (!window.confirm(t('confirmDelete'))) return;
    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        router.push(\`/${name}\`);
      },
    });
  }, [item, deleteMutation, router, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        {t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/${name}')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <${pascal}Avatar name={item.name} avatar={item.avatar} />
          <div>
            <h1 className="text-xl font-semibold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">{item.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGuard permission={${camel.toUpperCase()}_PERMISSIONS.WRITE}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          </PermissionGuard>

          <PermissionGuard permission={${camel.toUpperCase()}_PERMISSIONS.DELETE}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('confirmDeleteDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t('confirmDelete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('basicInfo')}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">{t('status')}</dt>
              <dd>
                <${pascal}StatusBadge status={item.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">{t('role')}</dt>
              <dd className="text-sm font-medium">{item.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">{t('createdAt')}</dt>
              <dd className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
`
  );

  // ── 6. Update tsconfig.base.json ────────────────────────────────────
  const tsConfigPath = 'tsconfig.base.json';
  const tsConfig = readJson(tree, tsConfigPath);

  const newPaths: Record<string, string[]> = {
    [`@myorg/modules/${name}/feature`]: [`libs/modules/${name}/feature/src/index.ts`],
    [`@myorg/modules/${name}/ui`]: [`libs/modules/${name}/ui/src/index.ts`],
    [`@myorg/modules/${name}/data-access`]: [`libs/modules/${name}/data-access/src/index.ts`],
    [`@myorg/modules/${name}/util`]: [`libs/modules/${name}/util/src/index.ts`],
  };

  tsConfig.compilerOptions = tsConfig.compilerOptions ?? {};
  tsConfig.compilerOptions.paths = {
    ...tsConfig.compilerOptions.paths,
    ...newPaths,
  };

  // Keep paths sorted alphabetically for consistency
  tsConfig.compilerOptions.paths = Object.fromEntries(
    Object.entries(tsConfig.compilerOptions.paths).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );

  writeJson(tree, tsConfigPath, tsConfig);

  await formatFiles(tree);

  return () => {
    // No install needed — generator only produces source files
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function toPascal(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toCamel(str: string): string {
  const pascal = toPascal(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
