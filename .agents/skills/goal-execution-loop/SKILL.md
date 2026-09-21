---
name: goal-execution-loop
description: Execute a Codex goal prompt through a supervised implementation loop. Use after goal-prompt-from-requirement generates a goal prompt, or whenever the user asks Codex to confirm a generated goal, implement it, use sub-agents to supervise the build process, review the completed code against the requirement, report errors back to the main flow, and iterate until the work satisfies the goal and verification has no blocking errors.
---

# Goal Execution Loop

## Overview

Run a goal prompt as a controlled execution loop: confirm the task, implement the work, use one sub-agent to supervise the build process against the goal, use another sub-agent to review the finished changes, and keep fixing until the goal is satisfied and verification has no blocking errors.

This skill is intended to follow `goal-prompt-from-requirement`.

## Required Loop

1. Read the goal prompt and any linked requirement/source documents.
2. Restate the task in concise terms and identify:
   - objective
   - scope
   - constraints
   - success criteria
   - verification commands or checks
   - assumptions and open questions
3. Ask the user to confirm the task before implementation if the user has not already confirmed it.
4. After confirmation, execute the implementation.
5. Spawn a supervision sub-agent at the start of implementation.
6. Continue implementation while the supervision sub-agent checks whether the work is drifting from the goal.
7. Run the narrowest relevant verification.
8. Spawn a review sub-agent after implementation.
9. If review or verification finds requirement gaps or errors, fix them in the main flow.
10. Repeat verification and review until:
    - success criteria are satisfied
    - no blocking runtime/type/lint/test/build errors remain
    - remaining gaps, if any, are explicitly non-blocking and reported

Do not mark the task complete before the review loop passes.

## User Confirmation

Before editing files, present a short confirmation summary:

```markdown
## Task Confirmation

- Objective:
- Scope:
- Constraints:
- Verification:
- Assumptions:

Please confirm before I start implementation.
```

If the user already gave explicit approval to execute the goal, do not ask again. State the confirmation briefly and continue.

Ask clarification questions instead of confirmation when a missing decision can materially change implementation scope.

## Supervision Sub-Agent

Spawn one sub-agent near the start of implementation to supervise direction. Use `multi_agent_v1.spawn_agent` when available.

Purpose:

- compare the current plan and evolving changes against the goal prompt
- catch scope drift, over-engineering, missing constraints, or ignored acceptance criteria
- report concise risks back to the main flow

Recommended prompt:

```text
You are the implementation supervisor for this goal.

Read the goal prompt and monitor whether the main implementation plan stays aligned.
Do not edit files unless explicitly asked.
Focus on:
- scope drift
- missed success criteria
- ignored constraints
- over-engineering
- verification gaps

Return concise findings with severity and the exact requirement or criterion involved.
```

Use supervision feedback as input, but the main agent owns final implementation decisions.

## Review Sub-Agent

Spawn one sub-agent after implementation and initial verification.

Purpose:

- review changed files against the original goal prompt and requirement
- identify missed behavior, broken constraints, type/lint/test/build errors, or inadequate verification
- decide whether acceptance should pass or fail

Recommended prompt:

```text
You are the acceptance reviewer for this goal.

Review the final changed files against the goal prompt and requirement.
Do not make code changes.
Check:
- every success criterion
- stated constraints
- likely regressions
- lint/type/test/build errors from provided output
- missing verification

Return:
- PASS only if the implementation satisfies the requirement and no blocking errors remain
- FAIL with concrete findings if anything blocks acceptance
- NON_BLOCKING notes separately
```

If the reviewer returns `FAIL`, the main flow must fix the findings, rerun relevant verification, and request another review or continue the same reviewer thread with the new evidence.

## Verification Rules

Use the narrowest verification that proves the goal:

- lint target for touched project
- test target for touched project
- typecheck/build when relevant
- E2E only when behavior cannot be validated with narrower tests
- manual browser checks for UI flows when needed

Never claim verification passed unless the command or check actually ran and passed. If a command cannot run, report why and treat it as an unresolved risk unless another check covers the same intent.

## Completion Criteria

The task is complete only when all are true:

- user-confirmed goal has been implemented
- supervision concerns are resolved or explicitly dismissed with reason
- reviewer returns PASS, or all FAIL findings have been fixed and re-reviewed
- required verification passes without blocking errors
- final response lists changed files, verification evidence, and any residual non-blocking risks

## Failure Handling

If implementation cannot proceed:

- stop before speculative edits
- state the blocker
- list the exact decision or external dependency needed
- do not mark the goal complete

If review finds errors:

- summarize each error
- fix the smallest necessary scope
- rerun affected verification
- repeat review

## Final Response Shape

Keep the final response concise:

```markdown
已完成。

变更：
- <file/path>: <what changed>

验证：
- <command/check>: passed

验收：
- Supervisor: <resolved/no blocking issues>
- Reviewer: PASS

风险：
- <non-blocking risk or "无">
```
