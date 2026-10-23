# Watchdog — 变更评审守门清单

评审 `apps/kissen-admin`、`apps/lp-portal`、`apps/kissen-gateway-portal` 及其 `libs/modules/{kissen-admin,lp-portal,kissen-gateway}` 的变更时逐项检查。下列每条都对应本仓库已发生过的事故或既定决策，不是通用最佳实践；命名、格式、测试写法等已由 `.codex/project/rule.md` 覆盖，不在此重复。

**输出要求**：每条结论给出 `文件:行` → 触发路径 → 用户可见影响 → 证据（代码/配置/命令输出）。无法证实的标注「未证实」，不要用「建议/可能」凑数。分级：Blocker（构建失败、数据错误、越权、密钥泄露）/ Major（行为回归）/ Minor（可维护性）。

## 1. 门禁：必须实际执行，不得以阅读代替

- `npx nx build <app>` —— 类型检查只在 `next build` 里发生，`next dev` 不做，类型错只有 build 才暴露。
- `npx nx lint <project>`；改动 `libs/shared/*` 时额外跑受影响 app 的 build。
- `npx nx test <project>` —— `No tests found` + exit 0 不等于测试通过，只是该库没有 spec。
- 不要用 `tsc -b` 当门禁（project-reference 噪声大）；用 app 级 `nx build`。
- 三门户互不影响，改动其一只需 build 受影响 app，但共享改动要全跑。

## 2. 装配层：配置 → 路由 → 注册 四层同查

`configs/<app>.json` → `apps/<app>/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx`（slug→pageKey） → app-local `module-page-registry.ts` → `libs/modules/<portal>/*`

- 只加配置菜单项 ≠ 页面可访问。事故：`t_edit` slug 未登记、落到 fallback `detail`，组件齐全却永不挂载，lint/test/build 全绿也查不出。凡新增/改名 slug，必须追完整链路。
- 新增模块还需同步 `next.config.ts` 的 `transpilePackages` 与 `tsconfig.json` 的 paths，缺一即构建失败。
- locale 前缀：三门户 middleware 对非 `/en-US` 一律 308 重定向（English-only，有意决策）；admin 走 next-intl（`en-US`/`zh-CN`）。新增链接不得硬编码无前缀路径，也不得建议改回语言协商。
- 菜单有两个来源：登录返回的 `menuTree` 覆盖 `configs/*.json`（kissen-admin `toModuleItems`、gateway `filterMenuTree`、LP `apps/lp-portal/src/lib/lp-routes.ts` 的 `buildLpSidebarOrder`）。隐藏菜单须同时改静态 configs、运行时过滤与路由门禁。

## 3. 接口契约：按后端口径，不按直觉

- 信封两套不通用：kissen 网关 `code === '0'`（字符串），`@myorg/shared/data-access-api` 按数字 `code === 0`。用错会静默吞错。
- 分页 POST 体 `{ page: { pageNum, pageSize }, data: filter }`，响应 `{ rows, page: { total } }`。
- 过滤字段逐接口核对。事故：状态筛选字段是 `data.state`，写成 `data.status` 不报错也不过滤。
- 迁移 td-manage：上游 `useSWR([url])` = GET、`useSWR([url, payload])` = POST；漏 `/api` 前缀、把 GET 写成 POST 是同一批高频错误。
- BigDecimal 后端序列化为 `string | number`：金额字段类型必须含 string，展示走格式化器（普通金额 2 位、FX 4 位、token 保留 token 精度）；禁止把金额直接 `Number()` 参与运算。
- 状态码文案只有一处权威码表；同一 code 在 model 与 feature 各写一份文案即回归（交易 35/40 三端文案曾不一致）。
- 审批 `busCode` 须与后端 `WorkflowBusinessTypeEnum` 一致；`process` / `previousStep` / `withdraw` 入参不同（带 `approve` / 必填 `remarks` / 可选 `remarks`）。
- 缺后端能力时如实报缺口，禁止用静态值或前端推算兜底伪装完成。

## 4. 类型与数据流

- 列表把数值 id 规范化为字符串行键（`Omit<Row,'id'> & { id: string }`）；再把它当业务 id 传后端 = 类型错 + 语义错。事故：`busId={row.original.id}` 应为 `Number(row.original.id)`；同页 `ApprovalQueue` 的 `busId` 同样要还原数值。
- React Query：queryKey 稳定可序列化；`queryFn` 不返回 `undefined`（单对象 `null`、列表 `[]`）；mutation 成功后 invalidate 对应 key。
- 各 mutation hook 的变量类型不同，`mutate` 不可统一放宽成 `(vars: never, opts?: unknown)` 配 `as never`——这会让 build 失败而 dev 无感。
- `next-env.d.ts` 是生成文件：必须指向 `./.next/types/routes.d.ts`。提交 `./.next/dev/types/...` 会让其他 checkout/IDE 的 tsc 报 TS2307（已发生）。
- ESLint 未注册 react-hooks 规则：写 `eslint-disable-next-line react-hooks/exhaustive-deps` 会报 "Definition for rule not found"。
- spec 从定义文件直连 import，不走 barrel（barrel 会拉入 next-intl ESM，jest 下解析失败）。

## 5. 交付卫生与边界

- 业务模块之间不得互相 import：`libs/modules/{kissen-admin,lp-portal,kissen-gateway}` 相互隔离，`libs/shared/*` 不得依赖 `libs/modules/*`。绕过手段同样要报：跨库相对路径深导入、把业务模块从 shared barrel 重新导出、用 `eslint-disable` 消边界错误。
- `feature` 不得被 `data-access` 依赖（`type:*` 约束见 `eslint.config.mjs`）。
- 不提交 `.env.local`（`.gitignore` 已忽略 `.env*.local`）、`.omp/`、`.playwright-mcp/`、`build-*.log`、`.next/`。
- `NEXT_PUBLIC_*` 会进客户端 bundle：不得放真实密钥、内网地址、Jenkins 凭据 id。dev 预填凭据只在 development 生效，不得带进 production。
- 不夹带无关重构、大面积格式化，或顺手改 `libs/shared/*`（任务未明确要求时）。

## 6. 已知非问题（不要重复报告）

- `shared-util-config` 约 47 个 `@nx/enforce-module-boundaries` 报错是既有架构债，非本次引入。
- 详情页依赖列表行暂存（LP `sessionStorage` 的 `lp_tx_stash:`、kissen-admin `row-stash.ts`）：直接深链无暂存时显示 not-found 是既定语义。
- 仓库里被跟踪的 `.env.local` 属历史遗留，不是新增泄露（但新增内容仍不得进入提交）。
- `next build` 的 `The "middleware" file convention is deprecated` 警告、`NO_COLOR`、`strict-peer-dependencies` 等 npm 警告是工具噪音。
- jest target `No tests found` exit 0：不等于通过，也不等于失败。

## 7. 上游同步 / 迁移附加约束

- 保留业务语义，UI 重写不照搬上游实现。
- 上游死代码不搬运：无调用方的组件最多搬模型字段。
- 同概念双口径（如 draft 与 saved(draft)）以业务侧为准，不强行统一。
- 细节见 `.claude/skills/*/references/{constraints,pitfalls}.md`。
