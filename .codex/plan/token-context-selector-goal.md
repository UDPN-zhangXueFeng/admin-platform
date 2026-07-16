# Goal Prompt

You are working in `admin-platform`, an Nx + Next.js admin monorepo.

## Objective

Implement the token / coin / network context selector behavior described in `.codex/plan/token-context-selector-requirement.md` for the dashboard selector shown in the screenshots.

## Context

The existing dashboard already has a selector component at `apps/admin/src/app/[locale]/(app)/components/StablecoinTabs.tsx`, used by `apps/admin/src/app/[locale]/(app)/page.tsx`. It currently behaves like a token context selector, but it must support both `Tabs` and `Dropdown Lists` modes without changing the selected token when the display mode changes.

## Scope

- Update the existing stablecoin selector so it behaves as a controlled token context selector.
- Use a stable token id instead of an array index for selection.
- Support `tabs` and `dropdown` display modes from the parent page.
- Keep token selection and display mode state separate.
- Show loading and empty states explicitly.
- Replace the native invisible select dropdown with a visible list that includes icon, token label, and network text.
- Prevent long token or network labels from breaking layout.
- Add focused tests that encode the business rules.
- Document Storybook status without assuming Storybook is already installed.

## Constraints

- Keep changes surgical and aligned with the current dashboard implementation.
- Do not introduce a new UI library.
- Reuse existing shared UI primitives and Tailwind style conventions.
- Do not install Storybook dependencies unless explicitly approved.
- Preserve Nx module boundaries.
- Avoid fallback mock token data that masks loading or empty API states.

## Success Criteria

- Users can switch between `Tabs` and `Dropdown Lists`.
- Switching display mode calls only `onModeChange` and does not change selected token.
- Selecting a token calls `onValueChange` with a stable id, not an array index.
- `Tabs` mode shows all token options with active state and wrapping.
- `Dropdown Lists` mode shows the current token and opens a scrollable list.
- Loading state is shown before empty state.
- Empty state clearly shows that no token contexts are available.
- Long labels use truncation constraints.
- The dashboard page uses the selector with controlled `value` and `mode`.

## Verification

- Run `pnpm exec nx lint admin`.
- Run `pnpm exec nx test admin` or an equivalent Jest command with watchman disabled if the sandbox blocks watchman.

## Assumptions

- The existing `StablecoinTabs` is the target component represented by the screenshots.
- The selector belongs in the admin dashboard path for this task because that is the current implementation location; moving it into a module library is a separate architectural cleanup.
- Current workspace does not have Storybook installed/configured, so this task should not create runnable Storybook stories.
