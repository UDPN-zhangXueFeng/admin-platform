# 陷阱保真清单（td-manage-sync，源自 2026-07~09 apps/admin 迁移实战）

用途：实现与验证时**逐条核对**。权威版本：本文即权威；`.codex/project/memory.md` 是第一手长记录，新坑两边同步沉淀。

## 数据与运行时

1. **后端数值字段实际是 string**：model 标注 number 不可信，`reSet` 类格式化必须 `Number(value).toFixed(2)` 并放宽类型到 `string | number | undefined | null`。历史上 5 个文件各有一份副本需同步修。
2. **catch-all 路由 ID 提取**：`useParams()` 返回 `{locale, module, slug}`，**没有 `id` 字段**。group 路由（mmf/wallet/sys 等，`module=组名`）业务 ID 在 `slug[1]`；非 group 路由在 `slug[0]`。detail 页用了 `useParams<{id}>()` 的症状是「只渲染空壳」——这是排查详情页空白的第一刀。
3. **React Query mutation 返回对象每次 render 都是新引用**：在 `useCallback`/`useEffect` 依赖中使用必须解构 `const { data, mutate, isPending } = use*Mutation()`（`mutate` 引用稳定），否则无限重跑 + 后端 429。
4. **queryFn 成功返回不得为 undefined**：空数组/null/缺失响应归一化为 `null`（单对象）或 `[]`（列表），否则 TanStack Query 抛 `Query data cannot be undefined`。
5. **`NEXT_PUBLIC_*` 进程启动时内联**：改 `.env.local` 必须重启 dev（`hub restart`），HMR 不够。列表全空先查缺 `NEXT_PUBLIC_CONFIG_ID` 等前缀变量，再查 `code:3`（会话未认证）与真无数据的区别。

## 契约与口径

6. **HTTP 方法按上游 fetcher 语义判定**：`useSWR([url])`=GET、`[url,payload]`=POST；显式 `request(url,{method})` 以 method 为准。公共下拉统一 GET。曾发现 7 个下拉接口方法错迁（cross-chain 5 + screening 2），后端宽容返回 200 掩盖了错误。
7. **权限码口径**：按钮级用后端 UUID（旧页 `actions[].limit` 原样取），模块级 manifest 用语义码。混淆的症状是行内按钮全部 `--` 消失。
8. **页面 slug 非标准词**：`t_edit`/`onboard`/`mff` 等需在 page.tsx pageKey 解析有显式分支；新模块校验每个 list 页「新建」按钮的目标 slug。
9. **registry key 冲突**：一个 key 被多语义复用（如 `workflow` 已被 sys-workflow 占用）时不能再当占位；无 path 的 order 项会被回退成 `/{id}` 变成可点击路由。

## 门禁与验证

10. **`npx tsc -b` 不能作 apps/admin 门禁**：库级 project references 工程债（TS5090/6059/6307/6305）。有效门禁 = `npx nx build admin`（含 Next 类型检查）+ `npx nx lint <project>`。
11. **`module-registry.ts` 的 enforce-module-boundaries 违规是已知妥协**：中央注册表必须 import 所有 `@myorg/modules/*`，不阻塞 build，勿当回归修。
12. **迁移旧系统视觉资产先确认资源存在**：位图/图标缺失时用主题 CSS 变量与 lucide 图标替代，不留空色块占位。
13. **资源/文案重命名三层同步**：config order label、i18n title、manifest name——只改一处 = 菜单/面包屑/页面标题互相打架。
