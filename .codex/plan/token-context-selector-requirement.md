# Token Context Selector 需求文档

## 1. 背景总结

当前管理后台存在大量 token / coin / network 维度的数据查看场景。页面需要让用户在不同资产上下文之间快速切换，例如 `USDCoin (Besu)`、`USDC (Ethereum)`、`USDT (Polygon)`、`TRONX` 等。

从截图看，该区域不是单纯的 UI Tabs，而是一个「资产上下文选择器」。它需要在同一组选项数据上提供两种展示形态：

- `Tabs`：展示全部 token，支持快速扫视和直接切换。
- `Dropdown Lists`：只展示当前选中 token，通过下拉列表选择其他 token，节省页面顶部空间。

两种展示形态共享同一份数据、同一个 selected token 状态，以及同一套下游内容刷新逻辑。切换展示形态不应改变当前选中的 token。

## 2. 成功标准

- 用户可以在 `Tabs` 与 `Dropdown Lists` 两种模式之间切换。
- `Tabs` 模式下，所有 token 以可换行 tab/tag 形式展示，当前选中项高亮。
- `Dropdown Lists` 模式下，仅展示当前选中 token，点击后展开可滚动列表。
- 用户选择 token 后，下方页面内容按新 token 上下文刷新。
- 模式切换只改变展示形态，不改变 selected token。
- 长文本在 tab 与 dropdown 中都不会撑破布局。
- 组件具备 loading、empty、error 或 disabled 等基础状态设计。
- 组件可以在 Storybook 中被独立验证，覆盖核心交互状态。

## 3. 术语定义

- Token：业务资产，例如 `USDCoin`、`SARCoin`、`MMFTCoin`。
- Network：资产所属链或网络，例如 `Besu`、`CFLR`、`Polygon`、`TRON`、`SEPOLIA`。
- Token Context：由 token 与 network 共同组成的当前业务上下文。
- Display Mode：选择器展示形态，当前包含 `tabs` 与 `dropdown`。

## 4. 组件理解

组件建议命名为 `TokenContextSelector`。

它由三部分组成：

1. Token 展示与选择区
   - `Tabs` 模式：展示所有 token tab。
   - `Dropdown Lists` 模式：展示当前 token selector，并支持展开列表。

2. Display Mode 切换按钮
   - 使用 list/tabs 类 icon button。
   - 点击或 hover 后展示 popover。
   - popover 中包含 `Tabs` 与 `Dropdown Lists` 两个选项。
   - 当前模式需要高亮。

3. 下游内容上下文
   - 组件自身不直接处理统计业务。
   - 通过 `onValueChange` 通知外部刷新，例如 `USDCoin Statistics`。

## 5. 数据模型建议

```ts
export type TokenContextDisplayMode = 'tabs' | 'dropdown';

export interface TokenContextOption {
  id: string;
  tokenName: string;
  networkName: string;
  networkCode: string;
  iconType: 'stablecoin' | 'mmf' | 'td' | string;
  badgeVariant?: string;
  disabled?: boolean;
}
```

设计理由：

- `id` 必须稳定，不能依赖数组下标。
- `tokenName` 与 `networkName` 分离，便于展示、搜索、埋点和接口参数转换。
- `networkCode` 用于 badge 文案或业务传参。
- `iconType` 先承接现有 icon 类型，避免在 UI 层硬编码 token 名称。
- `badgeVariant` 保留样式扩展点，但不把颜色逻辑散落在组件中。

## 6. Props 建议

```ts
export interface TokenContextSelectorProps {
  options: TokenContextOption[];
  value: string | null;
  mode: TokenContextDisplayMode;
  loading?: boolean;
  disabled?: boolean;
  onValueChange: (id: string) => void;
  onModeChange: (mode: TokenContextDisplayMode) => void;
}
```

约束：

- 组件优先做 controlled component，状态由页面或上层 feature 管理。
- 组件不直接读写接口，不直接持久化 localStorage。
- 如果需要记住用户偏好，应由调用方或专门的 UI preference store 处理。

## 7. 交互规则

### Tabs 模式

- 每个 token 以 `icon + tokenName + network badge` 形式展示。
- 当前选中 tab 使用浅紫色背景、边框或文字高亮。
- token 数量较多时允许自动换行。
- 禁止横向撑破页面。
- 点击 disabled token 不触发 `onValueChange`。

### Dropdown Lists 模式

- 默认只展示当前选中项。
- 点击 selector 展开下拉列表。
- 下拉列表项展示 `icon + tokenName + (networkName)`。
- 当前选中项加粗或高亮。
- 列表高度固定，超出后滚动。
- 选择新 token 后：
  - 调用 `onValueChange`。
  - 收起 dropdown。
  - 不改变 display mode。

### Display Mode Popover

- 点击 icon button 展开模式菜单。
- 菜单包含：
  - `Tabs`
  - `Dropdown Lists`
- 当前模式高亮。
- 切换模式时调用 `onModeChange`。
- 切换模式不触发 `onValueChange`。

## 8. 边界状态

- Loading：展示 skeleton 或禁用态 selector，避免闪烁空状态。
- Empty：展示 disabled selector，文案可为 `No tokens available`。
- Error：由上层页面决定错误提示，组件只接受 disabled/error hint 时展示不可交互状态。
- Long text：token name 与 network name 需要 ellipsis，不能挤压 icon 或 mode button。
- Mobile：建议默认使用 dropdown 形态；如果产品要求保留 tabs，应改为可横向滚动或折叠。

## 9. 推荐落点

如果该组件只服务某个业务模块，应放在对应模块的 `ui` 或 `feature`：

```text
libs/modules/<domain>/ui/src/lib/token-context-selector/
├── token-context-selector.tsx
├── token-context-selector.spec.tsx
├── token-context-selector.stories.tsx
└── index.ts
```

如果后续多个业务模块都会复用，并且不包含领域 API 或业务耦合，可考虑沉入：

```text
libs/shared/ui/src/lib/token-context-selector/
```

当前推荐先放在具体业务模块内。原因是 token/network 的 icon、badge、默认模式、移动端策略可能仍有业务语义，过早放入 `shared` 容易形成不稳定公共 API。

## 10. Storybook 创建建议

当前仓库 `package.json` 暂未发现 `@storybook/*` 依赖，也未发现 `.storybook` 或 `.stories.*` 文件。因此 Storybook 需要分两步处理。

### 10.1 如果目标库已经接入 Storybook

新增：

```text
token-context-selector.stories.tsx
```

建议覆盖以下 stories：

- `TabsMode`：默认 tabs 展示，多 token 换行。
- `DropdownMode`：默认 dropdown 展示。
- `LongNames`：验证超长 token/network 文案省略。
- `Loading`：验证 loading 不可交互状态。
- `Empty`：验证空数据状态。
- `DisabledOptions`：验证部分 token disabled。

运行方式按目标库 project target 为准，例如：

```bash
pnpm exec nx storybook <project-name>
```

### 10.2 如果目标库尚未接入 Storybook

优先使用 Nx 官方生成器为目标库补齐 Storybook 配置，避免手写散落配置：

```bash
pnpm exec nx g @nx/react:storybook-configuration <project-name>
```

如果当前 workspace 未安装 Storybook 相关包，需要先确认是否允许引入依赖。不要在未确认的情况下直接新增 `@storybook/*` 依赖。

## 11. 实现提示词

```text
请在当前 Nx monorepo 中实现一个生产级 TokenContextSelector 组件。

业务背景：
- 这是管理后台的 token / coin / network 上下文选择器。
- 同一组选项需要支持 Tabs 与 Dropdown Lists 两种展示模式。
- Tabs 模式展示所有 token，适合快速切换。
- Dropdown Lists 模式只展示当前选中项，适合节省页面空间。
- 两种模式共享同一个 selected token 状态。
- 切换模式不能改变当前 selected token。

成功标准：
- 组件为 controlled component，接收 options、value、mode、loading、disabled、onValueChange、onModeChange。
- Tabs 模式展示 icon、token name、network badge，并支持自动换行。
- Dropdown Lists 模式展示当前 token，点击后展示可滚动列表。
- 模式切换 popover 包含 Tabs 与 Dropdown Lists，当前模式高亮。
- 长文本必须 ellipsis，不能撑破布局。
- loading、empty、disabled 状态可感知。
- 遵守仓库 Nx module boundary、TypeScript strict、React 组件规范和现有 UI 风格。
- 不引入新的 UI 基础库；优先使用已有 Radix UI、Tailwind CSS、lucide-react 和项目工具函数。

实现前请先阅读：
- 目标文件所在库的 src/index.ts
- 目标库已有 UI 组件写法
- 直接调用方或目标页面
- shared/util-classnames 等已有工具

完成后运行最窄范围验证：
- pnpm exec nx lint <project-name>
- pnpm exec nx test <project-name>（如果该库有 test target）
```

## 12. Storybook 提示词

```text
请为 TokenContextSelector 创建 Storybook stories。

前提：
- 先检查目标 project 是否已有 Storybook target。
- 如果没有 Storybook 配置，不要直接手写零散配置；请说明需要先通过 Nx Storybook generator 接入。

Story 要求：
- 使用真实感 mock data，包含 Besu、CFLR、Polygon、BNB、TRON、SEPOLIA、AVAX 等 network。
- 覆盖 TabsMode、DropdownMode、LongNames、Loading、Empty、DisabledOptions。
- Story 中用本地 state 模拟 value 与 mode 的 controlled 行为。
- 不直接请求接口。
- 不引入新的业务依赖。
- 确保组件在 360px、768px、1440px 宽度下文本不溢出、不遮挡。

验收：
- 能通过 pnpm exec nx storybook <project-name> 本地查看。
- 所有 stories 都能独立表达组件状态。
- 交互切换 selected token 与 display mode 后 UI 状态一致。
```

## 13. 待确认问题

- 默认 display mode 是 `tabs` 还是 `dropdown`？
- display mode 是否需要按用户持久化？
- selected token 默认来源是接口第一项、URL 参数，还是用户上次选择？
- 小屏是否强制使用 dropdown？
- token icon 与 network badge 的颜色映射是否已有统一来源？
- 下游统计内容刷新是否需要保留缓存或展示局部 loading？
