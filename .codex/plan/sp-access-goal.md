# Goal Prompt

You are working in `admin-platform`, an Nx + Next.js App Router admin monorepo.

## Objective

Implement the `sp-access` module in the current Nx architecture as a production-grade migration of the **new-version** old-system pages:

- `/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/sp-access/index.tsx`
- `/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/sp-access/t_edit.tsx`
- `/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/sp-access/t_view.tsx`
- `/Users/zhangxuefeng/reddate/poc/td-manage/src/lib/components/sp-access/*`

Use `/Users/zhangxuefeng/reddate/poc/td-manage/.doc/plan/sp-access-logic-analysis.md` as the analysis source, but treat `t_edit.tsx` and `t_view.tsx` as the authoritative old implementation for behavior.

## Context

The old `sp-access` module has two parallel implementations:

- Active new-version flow:
  - `index.tsx` routes Register/Edit to `/sp-access/t_edit`
  - `index.tsx` routes View to `/sp-access/t_view`
  - `t_view.tsx` renders the detail page through four sections/tabs: base info, user wallets, submitted transactions, and operation records
- Deprecated old flow:
  - `edit.tsx`
  - `view.tsx`
  - `approval.tsx`

The deprecated pages have no valid list-page entry and must not drive the migration. They may only be used as historical reference when a business concept is missing from the new-version pages.

The module manages the service-provider onboarding lifecycle:

- list service providers
- register service-provider access
- edit service-provider access when backend state allows it
- view service-provider detail
- configure tokenized-deposit access permissions
- configure OpenAPI and smart-contract access
- configure private-key custody model
- configure transaction submission policy
- view user wallets, submitted transactions, and operation records from the detail page

Approval has moved out to `approval-manage` and is not part of the `sp-access` module implementation.

## Important Source Findings

- `index.tsx` is the valid entry point and routes to `t_edit` / `t_view`.
- `t_edit.tsx` is the valid create/edit implementation and uses the strong typed API family from `@/typings/token-manage/V1`.
- `t_view.tsx` is the valid detail implementation and composes:
  - `BaseInfo`
  - `UserWallets`
  - `SubmittedTransactions`
  - `OperationRecords`
- `edit.tsx`, `view.tsx`, and `approval.tsx` are deprecated old pages and should not be migrated.
- The old new-version edit page has a real bug: `transactionPolicy` is submitted as `1,2` but is not read back during edit hydration. The new implementation must fix that round trip.
- The current repo already enables `sp-access` in `configs/stablecoin.json`; the module implementation and runtime registration must match the current Nx boundaries.

## Scope

- Add or complete `libs/modules/sp-access/data-access`.
- Add or complete `libs/modules/sp-access/util`.
- Add or complete `libs/modules/sp-access/feature`.
- Implement and export a valid `module-manifest` for `sp-access`.
- Register the module in `libs/shared/util-config/src/lib/module-registry.ts`.
- Add required `transpilePackages` entries in `apps/admin/next.config.ts`.
- Add required path mappings in `apps/admin/tsconfig.json`.
- Implement the list page based on the active old `index.tsx` behavior:
  - list service providers
  - filter by service-provider name, tokenized-deposit name, and status where supported by the backend
  - navigate to create, edit, and detail
  - expose edit only for states that the old entry point allows and refine this with real backend behavior when verified
- Implement the create/edit page based on `t_edit.tsx`:
  - create mode
  - edit mode
  - detail hydration
  - business license upload
  - service-provider basic information
  - tokenized-deposit permission selection
  - OpenAPI access permissions
  - smart-contract access permissions
  - wallet address, contract address, webhook URL, and KYC requirement
  - meta transaction setting
  - reconciliation frequency
  - private-key custody model
  - transaction policy
- Implement the detail page based on `t_view.tsx`:
  - base service-provider information
  - token permission configuration
  - business license / API document / secret-key download entry points where the current backend supports them
  - user wallets list
  - submitted transactions list
  - operation records list
- Preserve and fix the following core business semantics:
  - `privateKeyCustodyModel` parse / serialize consistency
  - `transactionPolicy` parse / serialize consistency
  - edit hydration must not silently overwrite backend `transactionPolicy`
  - `tdAccessList.accessList` must match the real backend contract
  - OpenAPI access type and smart-contract access type must use the backend values confirmed by real interfaces

## Constraints

- Do not migrate deprecated old pages as implementation sources:
  - `edit.tsx`
  - `view.tsx`
  - `approval.tsx`
- Do not reintroduce approval workflow into `sp-access`.
- Do not copy the old Antd-heavy architecture directly into the new repo.
- Do not copy old `BCMP.ANY` / `GlobalAny` typing patterns.
- Do not migrate localStorage-based button permission logic from old `CustomTable` unless the current repo already has an equivalent permission model.
- Do not add speculative cross-module abstractions.
- Keep `shared` independent from `libs/modules/*`.
- Keep changes surgical and local to the module plus required registration/build config files.
- Prefer current project stack:
  - `apiClient`
  - TanStack Query
  - current shared UI primitives
  - `next-intl`
  - dynamic module loading through `module-registry`
- If current shared UI primitives cannot cover a dense legacy behavior safely, implement local module components under `libs/modules/sp-access/feature` rather than weakening shared UI.

## Success Criteria

- `sp-access` resolves through the current dynamic module route system.
- The module exposes a valid `manifest`.
- The list page loads real service-provider list data and supports basic filtering and navigation.
- The create/edit page supports the active `t_edit.tsx` business flow:
  - create mode works with a real backend save request
  - edit mode loads real detail data
  - edit mode hydrates all key business fields
  - submit payload matches the real backend contract
  - business license upload returns and uses a valid real `fileId`
  - OpenAPI and smart-contract permissions are serialized correctly
  - `privateKeyCustodyModel` round trips correctly
  - `transactionPolicy` round trips correctly
- The detail page supports the active `t_view.tsx` business flow:
  - base info loads from real detail data
  - token permission configuration is visible
  - user wallets list is wired to the real detail list endpoint where available
  - submitted transactions list is wired to the real detail list endpoint where available
  - operation records list is wired to the real detail list endpoint
  - download actions are present where supported and fail loudly when backend data is unavailable
- The implementation respects current Nx boundaries and monorepo import conventions.
- No new lint errors are introduced in the new `sp-access` projects.
- Verification clearly separates:
  - behavior completed with real backend evidence
  - behavior blocked by backend state or environment
  - behavior not yet verified
  - pre-existing repository issues unrelated to this module

## Non-Goals

- Do not rebuild the deprecated old approval page.
- Do not implement `sp-access` approval decisions inside this module.
- Do not preserve the deprecated old `edit.tsx` / `view.tsx` UI behavior unless `t_edit.tsx` / `t_view.tsx` lacks a required business rule.
- Do not preserve old `CustomTable` permission implementation details.
- Do not assume the old i18n key structure must be preserved 1:1 before the new module structure is stable.

## Recommended Implementation Order

1. Re-read the analysis document and verify active source files: `index.tsx`, `t_edit.tsx`, `t_view.tsx`, and `src/lib/components/sp-access/*`.
2. Inspect current module patterns:
   - `libs/modules/key-management/*`
   - `libs/modules/order/*`
   - `libs/shared/util-config/src/lib/module-registry.ts`
3. Create or complete `data-access`, `util`, and `feature` libraries for `sp-access`.
4. Define explicit typed models and API wrappers for the active real endpoints.
5. Implement parse / serialize helpers for:
   - `transactionPolicy`
   - `privateKeyCustodyModel`
   - `tdAccessList.accessList`
6. Implement the list page.
7. Implement the create/edit form page with real detail hydration and upload handling.
8. Implement the detail page with base info, user wallets, submitted transactions, and operation records.
9. Register the module in runtime/build config files.
10. Run narrow lint checks and real-interface verification.

## Verification

Run the narrow lint checks:

- `npx nx lint modules-sp-access-util`
- `npx nx lint modules-sp-access-data-access`
- `npx nx lint modules-sp-access-feature`

Use real backend interfaces for functional verification:

- list page: verify `listPage` request and visible rows
- create page: upload a real business-license file, submit real `save`, then verify the created record from list/detail
- edit page: load a real editable record, hydrate fields, submit real `edit` if backend state allows it
- detail page: verify base info, token permissions, user wallets, submitted transactions, and operation records with real requests where endpoints are available

If a real backend request returns a business error, capture:

- endpoint
- request payload shape
- response `code` / `message`
- whether the same result is reproducible outside the page
- whether the issue is likely introduced by this module or blocked by backend/environment state

If broader type validation is attempted, distinguish between:

- errors introduced by this module
- pre-existing repository issues unrelated to this task

Do not claim full type-check or real workflow success unless the actual command/check passed.

## Assumptions

- The active backend contract is closest to the API family used by old `t_edit.tsx` and `t_view.tsx`, not the deprecated old pages.
- The first delivery target is a production-grade migration of the active new-version behavior, adapted to the current Nx architecture.
- Some real edit submissions may be blocked by backend workflow state; this must be reported as blocked only after the request shape is verified against the active contract.

## Open Questions

- Which records in the real backend are currently editable end-to-end, rather than blocked by workflow state such as "processing"?
- Which download actions from `t_view.tsx` are required in the first migrated delivery if the current backend does not expose all required document resources in the local environment?
- If the backend response schema differs from the active old typed API contracts, prioritize explicit mapping in `data-access` over weakening page-layer typing.
