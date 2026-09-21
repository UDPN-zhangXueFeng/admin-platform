<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

## 代码变更归档

本项目通过 `.claude/hooks/post-edit.sh`（PostToolUse hook）自动将每次代码修改归档到 `.doc/` 目录。

### 归档规则

- **触发条件：** 每次 AI 调用 `Write` 或 `Edit` 工具修改项目文件后自动触发
- **归档路径：** `.doc/YYYY-MM-DD.md`（按日期归档，同一天追加）
- **忽略范围：** `.doc/` 目录自身（防递归）、项目外文件

### 归档内容

每条归档记录包含：

| 字段 | 说明 |
|------|------|
| 文件路径 | 相对于项目根目录 |
| 变更类型 | 新增/覆写（Write）、修改（Edit） |
| 时间 | HH:MM |
| 变更摘要 | Edit 操作时提取 old_string / new_string 前 3 行 |

### 手动操作

如需手动归档，可在终端执行：

```bash
bash .claude/hooks/post-edit.sh <<< '{"tool_name":"Write","tool_input":{"file_path":"'<绝对路径>'"}}'
```

### 相关文件

- Hook 配置：`.claude/settings.json` → `hooks.PostToolUse`
- Hook 脚本：`.claude/hooks/post-edit.sh`
- 归档输出：`.doc/`（已在 `.gitignore` 中忽略）