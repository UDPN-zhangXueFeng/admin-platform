# 翻译约定：Vue3 + Element Plus → Next.js App Router + shared UI

事实来源优先级：本文件只写 lp-sync 特有约定；通用规范见 `.codex/project/rule.md`；本仓库结构与模块边界见 `.codex/project/pro.md`。

## 1. 代码落点（Nx 边界）

| 上游概念 | 下游落点 |
|---|---|
| `views/<page>/*.vue` 页面组件 | `libs/modules/lp-portal/feature/src/lib/<page>-pages.tsx`，barrel export |
| `api/<module>.ts` | `libs/modules/lp-portal/data-access/src/lib/<module>/`，类型进 `types.ts` |
| `components/`（跨页复用） | `libs/modules/lp-portal/feature/src/lib/`（lp 专属）或 `libs/shared/*`（真通用） |
| 路由/守卫 | `apps/lp-portal/src/app/[locale]/(app)/[module]/[[...slug]]/` + `src/lib/lp-routes.ts` |
| store（Pinia user） | 本项目现有会话方案（见 lp-client/auth data-access），不引入新状态库 |

`shared` 不得依赖 `libs/modules/*`；feature 页面组件必须是可独立加载的命名导出（registry 用 `lp('XxxPage')` 动态引入，specifier 必须是字面量字符串）。

## 2. 上游语法 → 下游等价物

| Vue | 本项目 |
|---|---|
| `<template>` + Element Plus | shared UI 组件 + tailwind；**不引入 Element 类组件库** |
| `el-table` 列定义 | 表格按项目现有表格模式实现，对齐同库其他页面写法 |
| `el-dialog` / `el-drawer` | shared dialog / drawer（关闭守卫、`close-on-click-modal=false` 等语义保真） |
| `el-message` / `ElMessage` toast | sonner toast（唯一提示通道） |
| `$confirm` 确认框 | shared alert-dialog 确认流 |
| `v-perm` 指令 | `perm-button.tsx` 等现有权限包装 |
| `formatMoney/formatTime/maskAddress` | `feature/src/lib/format.ts` 统一层；**上游三处私有变体已统一裁决，见文档 01 §B/E** |
| `value-format='x'` 毫秒字符串 | 下游日期组件统一数字毫秒，转换逻辑放共享 helper |
| scoped style / 内联主题色 | tailwind + 品牌主题 token（见文档 06） |

组件内置文案（Element 的分页/空态等）在上游是 zh-cn 注入；下游用英文，等价处理即可，不逐字对应。

## 3. 行为保真规则

- 状态映射表（STATUS_TEXT/TAG 色、TX 13 态等）逐键迁移，tag 色语义按 §E 陷阱（如 tx 35 列表 primary/抽屉 success）
- 确认流文案语义保真（如「重置密码→抄送一次性密码」「分配成功，下次请求生效」），语言换成英文
- 失败静默 vs toast 的语义照迁（markRead 失败静默、MSG_23_0024 降级等）
- 分页/筛选/排序是客户端还是服务端，照上游语义，不得擅自升级

## 4. 新功能接入（上游新增页面时，四层联动）

新增一个模块页必须同步检查四层，漏一层即回归：

1. **config**：`apps/admin/configs/*.json` 菜单，path 形状必须匹配 `apps/lp-portal/src/app` 的 App Router 结构
2. **route resolution**：`module-page-registry.ts` 补键（`<module>: { list: lp('XxxPage') }`）；`[module]` 动态段即路由入口
3. **module registry/loading**：`libs/shared/util-config` 侧配置加载（照 `kissen-gateway` 同构模式）
4. **feature/data-access**：页面组件 barrel export + api 模块 + types

键名约定：registry 顶层键 = 路由段；menuKey（如 `lp:token`）见 `configs` 与 `lp-routes.ts` 的映射。

## 5. 验证命令

```bash
npx nx build lp-portal && npx nx lint lp-portal   # 最窄静态验证
npx nx dev admin                                   # 冒烟（browser 驱动变更页面）
```

## 6. 品牌主题系统（权威规格：.doc/kissen/project/LP/06-品牌主题系统设计与实现.md）

lp-portal 三主题（violet/teal/emerald，`configs/lp-portal.json` `theme.themes`，default=emerald），配色已由 config 定义、互不相同。同步涉色规则：

- **上游任何颜色值不得直接落地**：Vue 侧 hex/内联色一律映射到主题 token（tailwind 键 `primary`/`ring` 用 `hsl(var(--primary))`；raw 键用 `text-[var(--brand-deep,#fallback)]` 类任意值，var 内逗号可用、不可有空格）
- **调色/加主题只改 `configs/lp-portal.json`**：每主题 19 键齐全（2 个 HSL 键 + 11 个 raw 品牌键 + 6 个 `illus-*` 插画键），不碰 CSS/组件
- **加新可主题化颜色**：`themePaletteSchema.colors` 是开放 `Record<string,string>`——config 加键 + 消费处 `var(--新键, fallback)`；要 tailwind 键需同步 ThemeInjector 键分类
- **品牌 SVG 必须内联**（`<img>` SVG 与 CSS 变量隔离；mask/currentColor 仅单色）：`apps/lp-portal/src/components/brand/` 内联组件，fill/stopColor 绑 `var(--token, 原hex)` 双保险
- **切换器** `feature/src/lib/theme-switcher.tsx`：零内置色，列表来自 config；localStorage key `lp-theme`；`themes < 2` 渲染 null
- 防闪 inline script 经合法 id 校验后写 `documentElement.dataset.theme`；shared 层插槽（`logo`/`illustration`）全部 opt-in，不传保持原 `<img>` 行为
