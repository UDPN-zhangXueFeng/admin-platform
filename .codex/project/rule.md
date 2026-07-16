# 前端代码设计与规范

## 1. 基本原则

本项目按生产级前端工程维护。所有新增和修改代码必须优先满足：

- 简单直接：只解决当前需求，不提前设计未使用的抽象
- 边界清晰：遵守 Nx module boundary，不跨层、跨域直接耦合
- 类型优先：使用 TypeScript 表达业务约束，避免用 `any` 绕过问题
- 可维护：代码结构、命名、导出方式与现有目录保持一致
- 可验证：行为变化必须能通过最窄范围的 lint/test/build 验证

## 2. 技术栈约束

当前仓库真实配置以 `package.json`、`tsconfig.base.json`、`eslint.config.mjs`、`.prettierrc` 为准。

关键栈：

- React、Next.js App Router、TypeScript
- Nx workspace 与 `@nx/enforce-module-boundaries`
- TanStack Query、Axios、Zustand
- Radix UI、Tailwind CSS、React Hook Form、Zod
- Jest、Testing Library、Playwright

不要引入新的框架、状态管理、请求库或 UI 基础库，除非已有方案不能满足需求，并且明确说明原因和迁移成本。

## 3. 目录与模块边界

### 应用层

`apps/admin` 只负责应用装配：

- App Router、layout、middleware、providers
- locale 路由
- 项目配置装载
- 调用模块 feature

不要把可复用业务逻辑、API 调用、通用 UI 长期放在 `apps/admin`。

### 领域模块层

业务代码优先放在对应模块：

```text
libs/modules/<domain>/
├── feature/
├── ui/
├── data-access/
└── util/
```

职责划分：

- `feature`：页面级、场景级组件，允许组合 `ui`、`data-access`、`util`
- `ui`：模块内展示组件，不直接处理远程请求
- `data-access`：接口、query、mutation、store、数据模型转换
- `util`：模块内常量、校验、权限、纯工具函数

### 共享层

`libs/shared/*` 只放跨模块稳定复用能力。`shared` 禁止依赖 `libs/modules/*`。

适合进入 `shared` 的内容：

- 基础 UI
- 通用 layout
- API client 和 query 基础设施
- i18n、auth、config、classnames、date/formatting 等平台工具
- 跨模块共享类型

不适合进入 `shared` 的内容：

- 单个业务域专属逻辑
- 只被一个页面使用的组件
- 依赖具体业务菜单或模块语义的工具

## 4. Nx 依赖规则

仓库通过 `eslint.config.mjs` 启用 `@nx/enforce-module-boundaries`。

Scope 约束：

- `scope:admin` 可依赖 `scope:admin`、`scope:shared`、`scope:modules`
- 单个业务模块只应依赖自身 scope 和 `scope:shared`
- `scope:shared` 只能依赖 `scope:shared`

Type 约束：

- `type:feature` 可依赖 `feature`、`ui`、`data-access`、`util`、`model`、`app`
- `type:ui` 可依赖 `ui`、`util`、`model`
- `type:data-access` 可依赖 `data-access`、`util`、`model`
- `type:util` 可依赖 `util`、`model`
- `type:model` 只能依赖 `model`
- `type:app`、`type:e2e` 可依赖所有允许范围

如果 lint 报 module boundary 错误，优先调整代码归属或依赖方向，不要通过相对路径、深层路径或配置豁免绕过。

## 5. 命名规范

### 文件与目录

- 文件夹默认使用 kebab-case，例如 `key-management`、`data-access`
- 业务模块目录使用业务名 kebab-case，例如 `key-management`
- 分层目录使用固定名称：`feature`、`ui`、`data-access`、`util`
- React 页面/组件文件默认使用 kebab-case，例如 `user-list-page.tsx`、`form-date-picker.tsx`
- 工具函数文件默认使用 kebab-case 或单词小写，例如 `api-client.ts`、`currency.ts`
- 类型、上下文、hooks、schema、config 等语义后缀允许使用点分段，例如 `auth.model.ts`、`auth.context.tsx`、`auth.hooks.ts`、`config.schema.ts`
- Next.js App Router 约定文件保持框架命名，例如 `layout.tsx`、`page.tsx`、`not-found.tsx`、`middleware.ts`
- 配置文件保持生态约定，例如 `next.config.ts`、`tailwind.config.ts`、`jest.config.ts`
- 测试文件：`*.spec.ts` 或 `*.spec.tsx`
- 组件目录：目录名与主文件名保持一致，例如 `button/button.tsx`
- 每个库通过 `src/index.ts` 作为公共导出入口
- 禁止新增 PascalCase 文件名；组件名用 PascalCase，文件名仍按 kebab-case

### TypeScript 与 React

- React component：PascalCase，例如 `UserListPage`
- Hook：`useXxx`，例如 `useUserList`
- 类型、interface、enum：PascalCase
- interface 不加 `I` 前缀，例如使用 `User`, 不使用 `IUser`
- type/interface 优先使用业务名词，例如 `UserListItem`、`PaginationParams`
- props 类型使用 `XxxProps`，例如 `UserFormProps`
- 变量、函数、props 字段使用 camelCase
- 普通局部常量使用 camelCase，例如 `pageSize`、`currentUser`
- 跨文件静态常量可用 SCREAMING_SNAKE_CASE，例如 `DEFAULT_PAGE_SIZE`
- Boolean 命名使用语义前缀：`is`、`has`、`can`、`should`
- Boolean 变量避免反向含义，例如优先 `isEnabled`，避免 `isNotDisabled`
- 事件处理函数使用 `handleXxx`，例如 `handleSubmit`
- props 回调使用 `onXxx`，例如 `onSubmit`、`onOpenChange`
- 异步函数可用动词短语表达行为，例如 `fetchUsers`、`createOrder`
- 转换函数使用 `toXxx`、`mapXxxToYyy` 或 `normalizeXxx`
- 不使用无业务含义的缩写，例如 `btn`、`cfg`、`tmp`；短生命周期循环变量除外

### Nx project 与 import alias

- 共享库项目名：`shared-ui`、`shared-util-config`
- 模块库项目名：`modules-user-feature`、`modules-order-data-access`
- import 优先使用 `tsconfig.base.json` 中的 `@myorg/...` alias
- 不从其他库的 `src/lib/...` 深层路径导入，除非该库没有公共导出且需要先补齐导出入口

## 6. TypeScript 规范

仓库启用 `strict`、`noUnusedLocals`、`noImplicitReturns`、`noFallthroughCasesInSwitch`、`noImplicitOverride`。

要求：

- 禁止无理由使用 `any`；优先使用明确类型、泛型、`unknown` + narrowing
- 函数返回值如果影响公共 API，应显式标注
- 公共类型从 `model` 或对应库导出，不在多个模块重复定义
- API response 与 UI view model 分离，必要时在 `data-access` 做转换
- 表单和外部输入使用 Zod 或现有 schema 做校验
- 不把类型错误交给运行时处理

可接受的类型断言：

- 边界处解析第三方数据后，已完成 runtime 校验
- DOM 或框架 API 类型无法表达真实约束
- 断言旁边能从上下文看出安全原因

## 7. React 组件规范

- 默认使用 function component
- 组件保持单一职责，页面编排与基础展示拆开
- 派生状态优先计算得到，不重复放入 state
- 能用 props 表达的数据流，不引入全局状态
- 远程数据优先使用 TanStack Query，不在组件内手写重复请求生命周期
- 表单优先使用 React Hook Form + Zod
- 列表项必须使用稳定 key，不使用 array index 作为可变列表 key
- 可交互元素必须具备可访问名称，优先使用语义元素

组件拆分判断：

- 复用两次以上，或单组件承担多个明显职责，可以拆
- 只是为了“看起来更架构化”的单次封装，不拆
- 业务页面内部的小组件可以先 colocate，稳定后再移动到 `ui`

## 8. 状态与数据请求

### TanStack Query

- 服务端状态使用 TanStack Query
- query key 必须稳定、可序列化，并表达业务维度
- mutation 成功后明确 invalidate 或更新缓存
- loading、empty、error 状态必须在 UI 中可感知

### Zustand

Zustand 只用于客户端共享状态，例如：

- 登录态派生信息
- UI 偏好
- 跨页面临时状态

不要把服务端列表、详情、分页结果长期放入 Zustand。

### Axios/API client

- API client 基础能力放在 `libs/shared/data-access-api`
- 领域接口封装放在对应 `libs/modules/<domain>/data-access`
- 不在组件内直接散落 Axios 调用
- 错误处理、token、拦截器等横切逻辑应复用 shared 基础设施

## 9. 样式与 UI 规范

- 优先使用现有 `libs/shared/ui`、`libs/shared/ui-layout`、`libs/shared/ui-forms`
- 基础交互组件优先复用 Radix 封装
- 样式优先遵循现有 Tailwind 写法
- className 合并使用现有 `cn` 工具
- 不新增全局 CSS，除非是 reset、token 或 App 级全局能力
- 不在业务组件中硬编码大量一次性 magic color，优先使用设计 token 或现有语义色
- UI 组件应支持基本 a11y：label、aria、focus 状态、键盘操作

当前未发现 stylelint 配置，因此不要声称 stylelint 已强制启用。若后续引入，应补充配置、脚本和本文档。

## 10. Lint、Format 与测试

### Format

`.prettierrc` 当前配置：

```json
{
  "singleQuote": true
}
```

不要在无关文件做纯格式化 churn。

### Lint

常用命令：

```bash
npx nx lint <project>
```

示例：

```bash
npx nx lint shared-ui
npx nx lint modules-user-feature
```

lint 错误必须优先修复根因。不要通过禁用规则解决架构边界问题。

### Test

单元和组件测试使用 Jest + Testing Library：

```bash
npx nx test <project>
```

E2E 使用 Playwright：

```bash
npx nx e2e admin-e2e
```

测试原则：

- 测试业务意图，不只测试实现细节
- 行为变化优先补测试
- shared utilities、配置解析、路由解析、复用 UI 需要更高测试优先级
- 每次提交前运行最窄相关 target，并记录无法运行的原因

## 11. 注释与文档

- 代码自解释优先，避免解释显而易见的赋值和调用
- 复杂业务规则、兼容逻辑、非显然约束需要写简短注释
- 公共工具函数、复杂 hook、复杂类型建议写 TSDoc
- 文档应描述当前真实状态，不把目标蓝图写成已完成事实

## 12. 禁止事项

- 禁止跨模块深层 import 绕过 Nx 边界
- 禁止在 `shared` 引入具体业务模块依赖
- 禁止为单次使用创建全局抽象
- 禁止无理由引入新依赖
- 禁止在组件内散落 API 请求、token 处理、权限判断等横切逻辑
- 禁止隐藏未验证状态，例如未运行测试却写“测试通过”
- 禁止顺手重构无关代码或大面积格式化无关文件

## 13. 推荐提交流程

1. 明确变更影响的 app/lib
2. 阅读目标文件、直接调用方和相关 shared 工具
3. 按最小范围修改
4. 运行最窄相关 lint/test/build
5. 汇总变更、验证结果和未覆盖风险
