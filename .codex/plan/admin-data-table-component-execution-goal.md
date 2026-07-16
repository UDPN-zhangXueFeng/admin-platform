# Goal Prompt

You are working in `admin-platform`, an Nx + Next.js App Router admin monorepo.

## Objective

Implement Iteration 1 of the admin data table component plan: create a presentation-only `DataTablePanel` for shared admin list layouts.

## Context

The old `td-manage` `CustomTable` mixed table UI, request lifecycle, pagination protocol, permissions, copy behavior, and route-specific logic. The current repo already has a lower-level `DataTable` in `libs/shared/ui/src/lib/data-table/data-table.tsx`, and shared UI must not depend on module code.

## Scope

- Add `DataTablePanel` under `libs/shared/ui/src/lib/data-table/`.
- Compose title, extra content, filter slot, error message, and the existing `DataTable`.
- Keep `DataTablePanel` presentation-only: callers pass `columns`, `data`, `pagination`, `isLoading`, `error`, and `emptyMessage`.
- Export the new component and its props from the existing data-table public entry.
- Add focused tests for title/filter/table rendering, loading-before-empty behavior, empty state, and visible error state.

## Constraints

- Do not implement API requests, TanStack Query hooks, row actions, copyable cells, permissions, route handling, or mutation invalidation in this iteration.
- Reuse the existing `DataTable`; do not break its public API.
- Do not introduce Antd, SWR, Headless UI, `copy-to-clipboard`, or any new UI foundation.
- Preserve Nx module boundaries: `shared-ui` must not depend on `libs/modules/*`.
- Use existing Tailwind and `cn` conventions.

## Success Criteria

- `DataTablePanel` renders header, extra action area, filter slot, and table rows.
- Loading state is shown before empty state when `isLoading` is true.
- Empty state is visible after loading finishes with no rows.
- Error state is visible without hiding existing rows.
- The component does not know API parameter shape or perform remote fetching.
- `shared-ui` exports the new component.

## Verification

- Run `pnpm exec nx lint shared-ui`.
- Run `pnpm exec nx test shared-ui`.

## Assumptions

- The current request executes only Iteration 1; operation column and copy helper remain later iterations.
