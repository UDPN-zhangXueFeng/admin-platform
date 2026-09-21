---
name: goal-prompt-from-requirement
description: Convert a user-provided requirement Markdown document into a clear Codex goal prompt. Use when the user gives or references a requirements .md file, PRD, task brief, product spec, implementation plan, or acceptance criteria and asks to generate a goal, objective, execution prompt, or Codex-ready task prompt from it.
---

# Goal Prompt From Requirement

## Overview

Turn a requirement Markdown document into a concise, actionable goal prompt that Codex can use to execute the work. Preserve business intent, surface ambiguities, and define success criteria without inventing scope.

## Workflow

1. Read the requirement Markdown fully before drafting.
2. Extract only task-relevant facts:
   - objective and background
   - target users or affected roles
   - in-scope work
   - out-of-scope work
   - constraints and dependencies
   - business rules
   - acceptance criteria
   - required verification
   - open questions or missing information
3. Classify ambiguity:
   - If ambiguity blocks execution, ask concise clarification questions before producing the final prompt.
   - If ambiguity does not block execution, state assumptions inside the generated prompt.
4. Generate a goal prompt that is implementation-ready and measurable.
5. Do not rewrite the requirement into a long spec unless the user asks for that. The output is a prompt, not a full project document.

## Output Format

Use this structure by default:

```markdown
# Goal Prompt

You are working in `<project/context>`.

## Objective
<one clear outcome>

## Context
<short background distilled from the requirement>

## Scope
- <in-scope item>
- <in-scope item>

## Constraints
- <technical/business constraint>
- <boundary or dependency>

## Success Criteria
- <measurable acceptance criterion>
- <measurable acceptance criterion>

## Verification
- <specific command/check/review step>
- <specific command/check/review step>

## Assumptions
- <assumption, only if needed>

## Open Questions
- <blocking or important question, only if needed>
```

If the requirement is small, compress sections while preserving Objective, Scope, Success Criteria, and Verification.

## Quality Rules

- Use the user's language unless they ask otherwise.
- Keep the goal prompt direct and executable.
- Prefer concrete nouns and paths from the requirement.
- Preserve explicit priorities and exclusions.
- Do not add speculative features.
- Do not hide uncertainty; list assumptions and open questions.
- If the requirement references files or modules, keep those references in the prompt.
- If the requirement includes acceptance criteria, convert them into measurable Success Criteria.
- If verification is not specified, infer the narrowest reasonable checks from the context and label them as assumptions.

## Clarification Triggers

Ask before generating the final prompt when:

- the target repository, app, module, or file is unclear
- the requested output type is unclear
- acceptance criteria conflict
- implementation scope would materially change based on a missing decision
- the requirement includes multiple unrelated goals and no priority

Limit clarification to the smallest useful set of questions.

## Example Output

```markdown
# Goal Prompt

You are working in `admin-platform`, an Nx + Next.js admin monorepo.

## Objective
Implement the user management list filtering behavior described in the requirement document.

## Context
The admin app uses locale-prefixed routes and domain code under `libs/modules/user`.

## Scope
- Add status and keyword filtering to the user list page.
- Keep data access changes inside `libs/modules/user/data-access`.
- Reuse existing shared UI components.

## Constraints
- Do not add new global state for server data.
- Preserve existing Nx module boundaries.

## Success Criteria
- Users can filter the list by status and keyword.
- Filter changes update the query state consistently.
- Empty and error states remain visible.

## Verification
- Run `npx nx lint modules-user-feature`.
- Run the narrowest relevant Jest test target.

## Assumptions
- Existing API supports the required filter parameters.
```
