# tokenized-deposit 开发参考（目标约定速查）

> 所有开发子 agent 的单一事实源。开发前必读本文 + `tokenized-deposit.md`（迁移文档）对应章节。
> 来源：Explore agent 探查 admin-platform 现有模块（cross-chain/blockchain/mmf）得出。

## 1. 四层库结构（手工创建，无 nx generator）

```
libs/modules/tokenized-deposit/
  data-access/  project.json name=modules-tokenized-deposit-data-access tags=[scope:tokenized-deposit,type:data-access]
  feature/      name=modules-tokenized-deposit-feature tags=[...,type:feature]
  ui/           name=modules-tokenized-deposit-ui tags=[...,type:ui]
  util/         name=modules-tokenized-deposit-util tags=[...,type:util]
```

每层含：`project.json` + `jest.config.ts` + `src/index.ts`(barrel) + `src/lib/...`。**库层级无独立 tsconfig.json**（路径映射在根 tsconfig.base.json + apps/admin/tsconfig.json）。

project.json 范本（抄 cross-chain/data-access/project.json，改 name/sourceRoot/tags/jestConfig 路径）：
```json
{
  "name": "modules-tokenized-deposit-data-access",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/modules/tokenized-deposit/data-access/src",
  "projectType": "library",
  "tags": ["scope:tokenized-deposit", "type:data-access"],
  "targets": {
    "lint": { "executor": "@nx/eslint:lint", "outputs": ["{options.outputFile}"] },
    "test": { "executor": "@nx/jest:jest", "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": { "jestConfig": "libs/modules/tokenized-deposit/data-access/jest.config.ts", "passWithNoTests": true } }
  }
}
```
jest.config.ts 范本（抄 cross-chain）：
```ts
export default { extends: '../../../jest.preset.cjs', testEnvironment: 'node',
  coverageDirectory: '../../../coverage/libs/modules/tokenized-deposit/data-access',
  transform: { '^(?!.*\\.(js|jsx|ts|tsx|cts|mts|d\\.[cm]?ts)$)': '@nx/react/plugins/jest' },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  displayName: 'modules-tokenized-deposit-data-access' };
```

## 2. paths 双注册（漏一处 nx 误报 lazy）

**根 `tsconfig.base.json`** compilerOptions.paths 加（前缀 libs/）：
```json
"@myorg/modules/tokenized-deposit/data-access": ["libs/modules/tokenized-deposit/data-access/src/index.ts"],
"@myorg/modules/tokenized-deposit/feature": ["libs/modules/tokenized-deposit/feature/src/index.ts"],
"@myorg/modules/tokenized-deposit/ui": ["libs/modules/tokenized-deposit/ui/src/index.ts"],
"@myorg/modules/tokenized-deposit/util": ["libs/modules/tokenized-deposit/util/src/index.ts"]
```
**apps/admin/tsconfig.json** compilerOptions.paths 加同样 4 条（前缀 ../../libs/）。

## 3. module-registry.ts 注册（feature 完成后做，td-24）

文件 `libs/shared/util-config/src/lib/module-registry.ts`。**方案 A 单模块**（tokenized-deposit 不拆 group）：
```ts
'tokenized-deposit': {
  manifest: () => import('@myorg/modules/tokenized-deposit/feature').then((m) => m.manifest),
  pages: {
    list: () => import('@myorg/modules/tokenized-deposit/feature').then((m) => ({ default: m.TokenizedDepositOverviewPage })),
    detail: () => import('@myorg/modules/tokenized-deposit/feature').then((m) => ({ default: m.TokenizedDepositViewPage })),
    edit: () => import('@myorg/modules/tokenized-deposit/feature').then((m) => ({ default: m.TokenizedDepositEditPage })),
    create: () => import('@myorg/modules/tokenized-deposit/feature').then((m) => ({ default: m.TokenizedDepositOnboardPage })),
  },
}
```
**pageKey 推导**（page.tsx）：slug=[]→list；slug[0]=create→create；slug[0]=edit→edit；**其他→detail**。故 `/tokenized-deposit`→list、`/tokenized-deposit/view`→detail、`/tokenized-deposit/edit`→edit、`/tokenized-deposit/onboard`→create。**无需改 GROUP_ENABLED_KEY**（方案 A 不用 group）。

manifest 范本（抄 blockchain module-manifest.ts）：
```ts
export const manifest: ModuleManifest = {
  id: 'tokenized-deposit', name: 'Tokenized Deposit', icon: 'Ticket',
  routes: [
    { path: '/tokenized-deposit', component: 'list', label: 'Tokenized Deposit', permission: '0574278982bc44e799c45191d82bd2d7' },
    { path: '/tokenized-deposit/view', component: 'detail', label: 'Detail' },
    { path: '/tokenized-deposit/edit', component: 'edit', label: 'Edit' },
    { path: '/tokenized-deposit/onboard', component: 'create', label: 'Onboard' },
  ],
  permissions: [...17 个权限码], i18nNamespace: 'modules.tokenized-deposit',
};
```

## 4. i18n 注册（4 处）

文件 `libs/shared/util-i18n-messages/src/lib/merge-messages.ts`，加 4 处：
1. en-US import 区：`import tokenizedDepositEn from './en-US/modules/tokenized-deposit.json';`
2. zh-CN import 区：`import tokenizedDepositZh from './zh-CN/modules/tokenized-deposit.json';`
3. messageMap en-US：`'modules/tokenized-deposit': tokenizedDepositEn,`
4. messageMap zh-CN：`'modules/tokenized-deposit': tokenizedDepositZh,`

JSON 文件：`src/lib/{zh-CN,en-US}/modules/tokenized-deposit.json`，扁平 key + `*_color_<value>` 色值（antd 色名 success/gray/processing/error/orange/red/green/blue）。
**ICU 单花括号** `{var}`（非 `{{var}}`）。**状态文案扁平 key**：`common_task_status_1`、`smart_contract_status_35` 等。

## 5. 共享组件

- `@myorg/shared/ui`：DataTable, Dialog, AlertDialog, Button, Select/SelectContent/SelectItem/SelectTrigger/SelectValue, Tabs/TabsContent/TabsList/TabsTrigger, Toast(sonner), Tooltip, Popover, Checkbox, Switch, Input, Label, Drawer, ScrollArea, Progress, Accordion, CopyableEllipsisText, RadioGroup, DropdownMenu, Separator, Badge
- `@myorg/shared/ui-forms`：FormDatePicker, FormSelect（**不支持逐项 disabled**，需 disabled 用原生 Select + Controller）
- `@myorg/shared/util-auth`：PermissionGuard（`<PermissionGuard permission={CODE}><Button/></PermissionGuard>`）
- `@myorg/shared/util-formatting`：formatCurrency, formatCompactCurrency
- `@myorg/shared/util-dates`：formatDate, DATE_FORMAT_SHORT, DATETIME_FORMAT_LONG
- `@myorg/shared/util-i18n`：useRouter（**非 next/navigation**，用 shared 包装版）, useTranslations

**Radix Select 坑**：SelectItem value 禁止空串（"全部"用 'all'）。

## 6. 依赖（均已装，除 dayjs）

crypto-js✓ @types/crypto-js✓ @tanstack/react-query✓ @tanstack/react-table✓ react-hook-form✓ @hookform/resolvers✓ zod✓ axios✓ next-intl✓ ethers✓ **dayjs 未装→用 date-fns**（COA EOD 时间转换用 date-fns parse/format）。

## 7. AES 加密（td-4，复制到 util 层）

cross-chain 已有 `libs/modules/cross-chain/util/src/lib/get-encryption-data.ts`（key `reddatespartan25` / iv `hongzao25spartan`，AES-CBC Pkcs7，输出大写）。**复制到 `libs/modules/tokenized-deposit/util/src/lib/get-encryption-data.ts`**（避免跨模块耦合，cross-chain 不应作依赖源）。已修复原 `let key` 全局污染（用 const DEFAULT_KEY/IV）。**迁移前仍读源 `td-manage/libs/utils/get/getEncryptionData.ts` 三次核对 key/iv**。

## 8. Query/Mutations 范本（抄 cross-chain）

keys.ts：`{ all: ['tokenized-deposit'], overview: () => [...all,'overview'], overviewList: (params) => [...overview(),'list',params], ... }`
queries.ts：`useQuery({ queryKey, queryFn:({signal})=>api(params,{signal}), placeholderData: keepPreviousData })`；详情 `enabled` 守卫；下拉 `select: filterDropdown, staleTime: 5*60*1000`（filterDropdown = `(data)=>Array.isArray(data)?data.filter(o=>o!=null):[]`）
mutations.ts：`useMutation({ mutationFn, onSuccess: ()=>qc.invalidateQueries({queryKey}) })`，**onSuccess toast/router 在调用方**

## 9. DataTable + react-hook-form 范本（抄 blockchain node-list-page）

- 分页请求体 `pageNum`/`pageSize`（非 page）
- 筛选变更 `pageNum` 重置 1
- DataTable `data` 每行需 `id: string`（API 层 `id: String(primaryKey)` 注入）
- 列 `cell: ({row}) => ...`，`accessorKey`/`id`
- 状态色：`const tone = t('xxx_status_color_'+status); const label = t('xxx_status_'+status)`，TONE_CLASS Record 映射 antd 色名→Tailwind class（success→green, processing→blue, error→red, gray/default→gray, orange→orange）

## 10. pnpm nx 命令

```bash
pnpm nx lint modules-tokenized-deposit-data-access   # 也可 -feature/-ui/-util
pnpm nx test modules-tokenized-deposit-data-access
pnpm nx typecheck modules-tokenized-deposit-data-access
```
name 格式 `modules-tokenized-deposit-<layer>`。

## 11. 建库检查清单（td-1 执行序）

1. 建 4 层目录 + project.json + jest.config.ts + src/index.ts 空 barrel
2. tsconfig.base.json 加 4 条 paths
3. apps/admin/tsconfig.json 加 4 条 paths
4.（i18n/manifest/registry 在 td-2/td-24 做）
5. `pnpm nx lint modules-tokenized-deposit-{data-access,feature,ui,util}` 4 个全绿（passWithNoTests）

## 12. 关键运行时坑（必避）

1. i18n 双重前缀：useTranslations('modules.tokenized-deposit') 已在 namespace，常量 labelKey 不带 `tokenized-deposit.` 前缀
2. Radix Select SelectItem value 禁空串（'all'）
3. ICU 单花括号 `{var}`
4. 下拉 select 防 null（filterDropdown）
5. 分页字段 pageNum（非 page）
6. DataTable 行需 id: string
