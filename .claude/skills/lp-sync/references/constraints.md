# 锁定约束（来源：.doc/kissen/project/LP/00-README.md §4，2026-08-27 用户裁决）

任何 lp-sync 的实现不得违反；与上游行为冲突时，除第 1 条文案语言外，行为保真优先、呈现方式按本约束。

1. **全局默认英文，零 CJK**：所有用户可见文案（含 toast、表单校验消息、空态、STATUS 映射、菜单名渲染 fallback）一律英文。`menu_name_en` 双语字段照迁，侧栏只渲染英文。
2. **提示通道唯一 sonner toast**：禁止其他提示组件。确认类交互用 shared alert-dialog（属确认流）；一次性密码展示用 dialog（属数据展示）。
3. **登录页铺满视口**，不限制宽度。
4. **响应式**：1280×800 主验收口径，1280–4K 全断点逐页校验，MacBook 小屏必须适配。
5. **admin 模块功能完全隔离**：跨系统仅 shared UI 组件可共用；lp-portal 代码不进其他模块，反之亦然。
6. **零新增外部依赖**：需要新依赖必须先问用户。

## 英文术语表（上游中文 → 固定英文，保持全站一致）

| 上游中文 | 英文 |
|---|---|
| 申请中 / 已驳回 / 已开通 / 停用 | Pending / Rejected / Active / Disabled |
| 参与生效 | Participating（pair status 20） |
| 已开池 / 未开通 | Pooled / Not pooled |
| 查询 / 重置 | Search / Reset |
| 已同步 N 条 / 已是最新 | Synced N items / Up to date |
| 功能将在后续版本开放 | Coming soon |
| 数据初始化中——业务副本正在从 Kissen 拉取… | Initializing — syncing business data from Kissen… |
| 暂无通知 | No notifications |
| 强制下线 | Force logout |
| 一次性密码 | One-time password |
| 出款池 | Payout Pool |
| 设为出款池 / 当前出款池 | Set as payout pool / Current payout pool |
| 解付授权对象 | Payout Spender |
| 未配置（暂不能解付） | Not configured (cannot pay out) |
| 部分域同步失败（X），已同步 N 条 | Partial sync failure (X) — synced N items |
| 收 / 付（激活池地址前缀） | In / Out |
| 所有序列已隐藏——点击图例恢复 | All series hidden — click a legend item to restore |

新术语首次翻译时定稿并回填本表。
