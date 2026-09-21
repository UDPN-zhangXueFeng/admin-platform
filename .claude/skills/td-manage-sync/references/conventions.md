# 落点与实现约定：td-manage（Pages Router + SWR）→ apps/admin（App Router + Nx）

事实来源优先级：本文件只写 td-manage-sync 特有约定；通用规范见 `.codex/project/rule.md`；结构与模块边界见 `.codex/project/pro.md`。与 admin-sync 的 conventions 同构，但上游是 Next.js 而非 Vue，下游是双语 configs 驱动而非 menuTree。

## 1. 代码落点（Nx 边界）

| 上游概念 | 下游落点 |
|---|---|
| `src/pages/<module>/**` 页面 | `libs/modules/td-admin/feature/src/lib/<domain>/`，域内 barrel 命名导出；模块 key 对照 `apps/admin/src/lib/module-registry.ts` |
| `src/lib/api/<module>.ts` | `libs/modules/td-admin/data-access/src/lib/<domain>/`（api/queries/mutations/keys/model/constants 分文件） |
| `useSWR(...)` 数据获取 | TanStack Query hooks（`use-*.queries.ts`），语义映射：`revalidateOnFocus` 等按现有库惯例取舍 |
| `utils/`（reSet 等格式化） | 模块 `util/` 或 `libs/shared/util-formatting`，数值一律 `Number()` 防御 |
| 侧栏/菜单配置 | `configs/<project>.json` 的 `modules.order` + `modules.enabled`（涉及哪些项目文件与用户确认，默认 stablecoin.json 是 td-manage 主口径） |
| 路由 | `apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx` 的 pageKey 解析 + registry |
| 全局 fetcher / axios 封装 | `libs/shared/data-access-api`（apiClient），不改拦截器语义 |
| 旧项目权限指令 / `actions[].limit` | `libs/modules/td-admin/data-access` 域内 `*_PERMISSIONS` 常量（UUID，见 constraints §2） |
| import 语义 | 顶层用 `@myorg/modules/td-admin/{feature,data-access}`；歧义符号或精确定位走深路径 `@myorg/modules/td-admin/<pkg>/lib/<dom>[/文件]`。spec mock 只拦 hooks 所在文件级路径，值符号/常量直连定义文件 import（复刻旧 util/data-access 分包边界） |

**registry 双注册表特例**：

- 绝大多数模块：`apps/admin/src/lib/module-registry.ts`（中央表，47 keys；其对 `@nx/enforce-module-boundaries` 的违规是已知架构妥协，勿当回归）
- `sp-access`、`key-management`：`apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/module-page-registry.ts`（app-local，页面 key 级注册）

## 2. 上游语法 → 下游等价物

| td-manage（Pages Router） | 本项目（App Router） |
|---|---|
| `useRouter().push('/x?id=')` | locale 前缀路由（`/en-US/...`），query 形态保持 `?id=` |
| `useSWR` 条件获取 | query `enabled` 选项 |
| 页面级组件 + `getServerSideProps` 思路 | client component feature 页面 + data-access hooks（本项目业务页均为 client 动态加载） |
| 旧 UI 组件库/自研样式 | `libs/shared/ui` + tailwind，不引入旧组件库 |
| `message`/`notification` 提示 | 现有 toast/Dialog 方案（shared 层） |
| 中文硬编码文案 | i18n messages（en-US/zh-CN 双份） |

## 3. 行为保真规则

- 状态映射、tag 色、tooltip/空态、筛选/分页/排序语义（客户端 vs 服务端）逐条迁移
- 失败静默 vs 提示的语义照迁
- 页面 slug 不一定是 `index/view/edit`（有 `t_edit`、`onboard`、`mff` 等业务命名）：校验每个 list 页「新建」按钮目标 slug 在 page.tsx pageKey 解析有显式分支（非 fallback detail）

## 4. 新功能接入（四层联动）

1. **config**：`configs/*.json` 菜单 order + enabled，path 形状匹配 App Router
2. **route resolution**：`apps/admin/.../[module]/[[...slug]]/page.tsx` pageKey 解析（新 slug 需显式分支）
3. **registry**：`apps/admin/src/lib/module-registry.ts`（或特例 app-local registry）补键；feature barrel 必须命名导出组件
4. **feature/data-access**：页面组件 + api 模块 + model + i18n 双语键

## 5. 验证命令

```bash
npx nx lint <受影响 project>
npx nx test <受影响 project>   # 有测试时
npx nx build admin             # 发布门禁（tsc -b 有已知工程债，不作门禁）
npx nx dev admin               # 冒烟，locale 路由 /en-US/...；NEXT_PUBLIC_* 改动需重启
```

## 6. 环境变量

旧 `.env` 的公共前缀变量必须落到 `apps/admin/.env.local`：`NEXT_PUBLIC_API_BASE_URL`（旧 `NEXT_PUBLIC_AGENT_ID`）、`NEXT_PUBLIC_CONFIG_ID` / `NEXT_PUBLIC_MESSAGE_ID` / `NEXT_PUBLIC_FILE_ID`（动态 URL 前缀）、`NEXT_SERVICE_SERVER_URL`（注意新旧后端 IP 差异）。缺前缀变量的症状是列表空表 + 后端 404，不是前端渲染问题。
