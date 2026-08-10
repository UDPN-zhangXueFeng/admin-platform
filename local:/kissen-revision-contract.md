# Kissen 规划文档修订 · 权威决策契约（v1）

> 本文件是 8 份 plan 文档并行修订的**唯一事实源**。所有子任务据此用一致的值，禁止自创口径。
> 来源：`.doc/kissen/plan/09-计划完成度评估.md` §4 用户已答部分。
> **总原则：已答决策 → 立即落地；保留项（后端契约/未知项）→ 原样保留，不得删改、不得臆测填充。**

---

## 一、已答决策（全部落地，15 条）

### D1. Nx 业务库粒度 = 多库（Q-A，选项 2）
- **gateway**：6 个独立 Nx project，全部 `scope:kissen-gateway`（遵 04 §5 权威）：
  `kissen-gateway-onboard` / `kissen-gateway-tx` / `kissen-gateway-market` / `kissen-gateway-dashboard` / `kissen-gateway-audit` / `kissen-gateway-rbac`
- **lp**：8 个独立 Nx project，各带 per-domain scope（遵 05 §5.1 权威）：
  `kissen-pool`(scope:kissen-pool) / `kissen-topup`(scope:kissen-topup) / `kissen-rate`(scope:kissen-rate) / `kissen-pair`(scope:kissen-pair) / `kissen-txflow`(scope:kissen-txflow) / `kissen-settle`(scope:kissen-settle) / `kissen-receipt`(scope:kissen-receipt) / `kissen-notify`(scope:kissen-notify)
- **admin**：保持 03 §5 的 8 大业务域库（kissen-bank-onboard/lp-liquidity/fx/transaction/settlement/risk/dashboard/sysmgmt），scope:kissen-admin
- **后果**：02 §7 的 scope 列表 + 06 Step0.1 的 depConstraints 必须新增上述 gateway 1 个 + lp 8 个 scope（共 9 个新 scope，加 admin 现有 1 个 = 4 系统级 + lp 8 域级）。README §1「03/04/05 §5 权威」判定**成立**。
- **08 filter-repo 路径**必须改用这些权威库名（不再用 02 旧聚合名）。

### D2. rbac-admin = 抽取复用现有 role/user（Q-B，选项 1）
- 新建 `libs/shared/rbac-admin`（scope:shared），从现有 `libs/modules/role` + `libs/modules/user` 抽取通用 用户/角色/菜单 CRUD，剥离 td-manage 耦合。
- 02 §1 结论改为「抽取重构（非新建）」；§8/§9.3 删除「新建 vs 抽取待定」摇摆，统一为「抽取」。
- 06 Step0.3 的分支改为「抽取现有 modules/role+modules/user → shared/rbac-admin」。

### D3. lp_id 注入 = 后端 token 解析（Q-C，选项 2）
- **前端只携带 token，不传 lp_id**；后端 `LpContextHolder` 从 token 解析 lp_id；越权防护在后端。
- **shared 零改动**（不注入 X-LP-Id 头）。
- 05 §4.5（后端注入）为权威；05 §5.2「前端 data-access-api 注入 + LpContextHolder 在前端 util-auth」**删改**为：前端只带 token，LpContextHolder 是后端概念（前端文档引用时标注「后端」）。
- 02 §5.3、06 Step0.6 的「前端注入 X-LP-Id」**删除/改为**「前端只带 token，lp_id 由后端解析」。
- 补一张「三方各传什么」对照表（admin: 无 lp_id；gateway: 无 lp_id；lp: 无 lp_id，后端 token 解析）。

### D4. lg(1024~1279) sidebar = overlay 浮层（Q-D，选项 2）
- 折叠常驻 + 点击展开为 overlay 浮层（不挤压内容）。
- **需改现码** `lg:static` → 展开时 overlay；**删除**「保留默认 lg: 不覆盖」原则。
- 07 §0.1/§1.2 的「保留默认 lg」措辞删除；§2.2/§4.3 的 overlay 描述为唯一权威；§2.3 snippet 补 overlay-at-lg 实现。

### D5. 「零修改」放宽 = shared 注入缝/适配层（Q-E，选项 2）
- 撤回「零修改复用」「shared 零 if(system)」承诺。
- 在 shared 设计一个**注入缝/适配层**：各 app 配置 `authPath`（公开路径白名单）+ 信封解析（code/data 提取）。
- 02 §4.1/§5.3 改写：axiosClient/apiClient 提供配置点，各 app 注入自己的 authPath 与信封解析器；删除「零修改」「零分支」绝对措辞。
- 注：信封同构与否（B-1）属保留项，不臆测——适配层设计使其**不依赖**信封同构即可工作。

### D6. FR-L-02 preauth = 门户自助（Q-F，选项 1）
- LP 门户补 preauth 登记/编辑表单 + 查询页（对齐设计文档 §7.1 `/preauth/save`、`/list`）。
- 05 §4.5 新增 preauth 落点（list/detail/form 三段）；§5 Nx 模块归入 `kissen-pool` 或 `kissen-pair`（按 §5.1 现有归属）；§2 权限点补 preauth 对应 menu_key。
- 订正 05 §1.2/§4 把 FR-L-02 误并为「资金池登记」的错误。

### D7. 交付文档范围 = 全部不外发（Q-G）
- **07/08/README/09 一律不外发**，交付给甲方的只有代码 + configs，**不含任何 .doc 规划文档**（除非另出精简版，本轮不涉及）。
- 08 §2.1 随附表删除「02~06」外发项，改为「规划文档仅供内部，不随交付外发」；§5.1 自检命令注释统一为「交付仓不含任何 .doc」。
- 08 §2.1/§2.2 的随附/排除两表重新分类：所有 .doc/* → 排除（不外发）。
- README 顶部「面向甲方」相关措辞如有，改为「内部」。

### D8. 复杂交互设计稿 = 不需要（Q-I1）
- 06 风险表删除「交易链路树/LP 解付能力视图/审批待办 单独立设计稿评审」条目，改为「按现有设计文档直接实现，无需额外设计稿」。
- 02/06 相关「待设计稿」措辞删除。

### D9. 登录方式 = 独立登录，无 SSO（Q-I2）
- 三系统各自独立账密登录，**不走 SSO**。
- 02 §9.1 / README 待确认 #1 的「SSO vs 独立」**已答=独立**；loginFn 按各 app 独立 /auth/login 实现。
- 注意：具体登录端点契约（请求/响应字段）属保留项（B-18/Q-H3），不臆测。

### D10. 实时推送 = 无推送通道，用轮询兜底（Q-I3）
- 不引入 SSE/WebSocket；实时性需求（水位告警/汇率推送/通知中心）一律用 **TanStack Query 轮询**兜底。
- 02 §9.4 / 06 Step11 的「WS/SSE 待定」**已答=轮询**；删除「推送通道待确认」。
- 各 app 用 `refetchInterval` 轮询，轮询间隔按场景配置（通知 30s、汇率 60s、告警 15s 等，文档给建议值）。

### D11. 导出数据流 = 后端流（Q-I4）
- 导出由后端返回文件流，前端触发下载（非前端生成）。
- 03/05/06 的导出相关：统一为「调用后端导出接口，接收文件流触发下载」。
- 注意：具体导出端点/列范围（B-5）属保留项，不臆测 URL。

### D12. 可选 2FA = 无（Q-I5）
- 三系统均无 2FA；登录仅账密。
- 04/05 §3.5/§9 的「可选 2FA」**删除**；06 若有 2FA 相关 Step/风险项删除。
- 02/06 的「2FA」提及一并清理。

### D13. <1024 = 确认不支持（Q-I7，已 sign-off）
- 产品/甲方已确认：控制台对 <1024 宽度一律不支持，渲染「请用 ≥1024 设备」提示页（含 iPad/平板）。
- 07 §0.2/§1.3 的「<1024 不支持」从「工程理由单方声明」**升级为**「产品/甲方已确认（sign-off 2026-08-10）」；删除「需 sign-off」待确认项。
- 该决策已 closed，不再是 B 类依赖。

### D14. gateway 部署 = Node 镜像（Q-J2）
- kissen-gateway-portal 用独立 Node runtime 部署（**非** `output:'export'` 静态导出）。
- 02 §9.2 / 08 §8.2 的「export vs Node 待定」**已答=Node**；中间件/动态路由/rewrites 均可用。
- 08 §5.3 CI 产物方向定为 Node 镜像（Dockerfile）。

### D15. 许可证 = 商业闭源（Q-J3）
- 交付代码采用商业闭源专有许可（**非** MIT）。
- 08 §5.2/§5.4/§8.1：README 许可声明改为闭源；package.json license 字段改为专有（如 `"license": "UNLICENSED"` 或自定义）；删除 MIT 相关。
- 注意：根目录无 LICENSE 文件现状——交付仓需补闭源 LICENSE 文件（标注「待法务提供最终条款文本」，因具体条款措辞属保留项）。

---

## 二、保留项（原样保留，禁止填充/臆测，共 11 项）

以下用户「不知道/暂无/涉及后端暂不处理」，**文档中相关待确认标记保留不动**，仅可在措辞上标注「待后端/法务/甲方提供（见 09 §4 Q-X）」：

- **R1 (Q-H1)** 三后端响应信封是否 `{code,message,data}` / code 0/3/4 — 保留待确认（D5 适配层设计使其不阻塞，但仍标注「建议后端确认以简化适配」）
- **R2 (Q-H2)** §8 全量接口契约 DTO — 保留
- **R3 (Q-H3)** 04 登录响应体 + bankStatus 枚举 + 实例信息接口 — 保留（04 最核心阻塞）
- **R4 (Q-H4)** 04 chain 代理接口 + 上游 chain schema — 保留
- **R5 (Q-H5)** 05 lp-portal 接口响应 schema + 入向报文 — 保留
- **R6 (Q-H6)** 03 规则表/对账表/sys 表 DDL + 导出端点 + provision 回执源 — 保留
- **R7 (Q-H7)** 04 ACTION_REQUIRED payload + 处置语义 — 保留
- **R8 (Q-H8)** 05 地址校验规则 + chain 树结构/脱敏口径 — 保留
- **R9 (Q-I6)** onboard 联系人子字段集（暂无）— 保留待产品提供
- **R10 (Q-J1)** 设计文档真实版本（不知道）— **保留所有版本号引用不动**，不臆改 v1.0/v1.7~1.9
- **R11 (Q-J4/Q-J5)** force-push 法务接受度 + 历史密钥脱敏范围（不知道）— 保留待法务/安全

---

## 三、通用编辑约定
- **先读后改**：每个子任务必须先完整读目标文件，再用编辑工具做精准修改，不重写整文。
- **保留项不动**：触及保留项时只允许加「（待提供，见 09 Q-X）」标注，禁止填充臆测内容。
- **版本号**：任何版本引用（v1.0/v1.7/v1.8/v1.9）一律保留原样（R10）。
- **禁词**：06 不得引入「人日/估算/N人/并行分配/分工/排期」。
- **scope 一致**：import 路径用 `@myorg/*`，package.json name 用 `@admin-platform/*`（README §3 规则）。
- **章节编号**：不擅自改 §4.x 编号（03 用 §4.10、04/05 用 §4.5 的既有约定保留）。
- **最小改动**：只改与已答决策直接相关的段落，不顺手重构无关内容。
