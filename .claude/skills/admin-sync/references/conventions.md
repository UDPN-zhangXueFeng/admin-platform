# 翻译约定：Vue3 + Element Plus → Next.js App Router + shared UI（kissen-admin）

事实来源优先级：本文件只写 admin-sync 特有约定；通用规范见 `.codex/project/rule.md`；结构与模块边界见 `.codex/project/pro.md`。与 lp-sync/gateway-sync 的 conventions 同构，路径替换为 admin 对应物。

## 1. 代码落点（Nx 边界）

| 上游概念 | 下游落点 |
|---|---|
| `views/<page>/*.vue` 页面组件 | `libs/modules/kissen-admin/feature/src/lib/<page>-pages.tsx`，barrel export |
| `api/<module>.ts` | `libs/modules/kissen-admin/data-access/src/lib/<module>/`，类型进 `types.ts` |
| 跨页复用组件 | feature lib（admin 专属）或 `libs/shared/*`（真通用） |
| 路由/守卫/布局 | `apps/kissen-admin/src/app/[locale]/(app)/[module]/[[...slug]]/` + `kissen-app-shell.tsx` |
| store（Pinia） | 本项目现有会话方案（kissen-client/auth data-access），不引入新状态库 |
| 权限指令 | `use-kissen-perm.ts` 现有包装 |

feature 页面组件必须是可独立加载的命名导出（registry 动态引入，specifier 必须是字面量字符串）；feature barrel 不能导出非组件值（历史踩坑：常量导出炸生产 TS 检查）。

## 2. 上游语法 → 下游等价物

| Vue | 本项目 |
|---|---|
| `<template>` + Element Plus | shared UI + tailwind，不引入 Element 类组件库 |
| `el-table` / `el-dialog` / `el-drawer` | 项目现有表格模式 / shared dialog / drawer，关闭守卫等语义保真 |
| `el-message` / `$confirm` | sonner toast（唯一出口）/ shared AlertDialog |
| 格式化 | 项目统一格式化层；时间 en-US 24h |
| scoped style / 内联主题色 | tailwind + config 驱动品牌主题 token |

## 3. 行为保真规则

- 状态映射、tag 色、tooltip/空态语义逐条迁移，文档 01 易漏细节逐条核对
- 确认流文案语义保真，语言换英文
- 失败静默 vs toast 的语义照迁；客户端/服务端分页、筛选、排序语义照迁

## 4. 新功能接入（四层联动）

1. **config**：`apps/admin/configs/*.json` 菜单，path 匹配 App Router 结构
2. **route resolution**：`apps/kissen-admin/.../[module]/[[...slug]]/module-page-registry.ts` 补键
3. **module registry/loading**：`libs/shared/util-config` 侧配置
4. **feature/data-access**：页面组件 barrel + api 模块 + types

## 5. 验证命令

```bash
npx nx build kissen-admin && npx nx lint kissen-admin
npx nx dev admin   # 或 kissen-admin dev，browser 冒烟变更页面
```

## 6. 品牌主题系统（权威规格：.doc/kissen/project/LP/06-品牌主题系统设计与实现.md，LP 已验证模式）

**已接入（2026-08-28）**：3 套独立主题 `azure`（默认）/`midnight`/`cobalt`，蓝系家族 + accent 拉开（钢银/琥珀金/珊瑚橙），与 LP（violet/teal/emerald）、gateway（靛/青）零撞色。每主题 18 键（`primary`/`ring` HSL + 16 raw 键含 `illus-*`）；`defaultTheme: "azure"`；localStorage key `kissen-admin-theme`。品牌资产已内联：`apps/kissen-admin/src/components/brand/login-illustration.tsx`（等距清算立方体，43 处 var 绑定）；登录页品牌色已 de-LP 化（原 #001a98/#00a5d5/#554eea 系 LP violet 值直写，改绑 `var(--brand-deep)`/`hsl(var(--primary))`）。

- **接入时照抄 LP 06 模式**：`configs/kissen-admin.json` 写 `theme.themes`×3（每主题 19 键：`primary`/`ring` HSL 三段式 + `brand-deep` 等 raw 键 + `illus-*`）+ `defaultTheme`；app layout ThemeInjector + 防闪 inline script（localStorage key 用本项目自己的，如 `kissen-admin-theme`，不与 LP 共用）；品牌 SVG 内联组件；feature 侧 theme-switcher
- **上游任何颜色值不得直接落地**：Vue 侧 hex/内联色一律映射主题 token（`hsl(var(--primary))` / `text-[var(--brand-deep,#fallback)]`，var 内逗号可用不可有空格）
- **调色/加主题只改 config**，不碰 CSS/组件；shared 层插槽（`logo`/`illustration`）保持 opt-in，不传时零行为变化
- 主题色板由用户给定/自定义生成，三项目（LP/gateway/admin）主题 id 与配色不得互相复制
