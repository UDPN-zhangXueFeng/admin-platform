# 锁定约束（来源：.doc/kissen/project/gateway/00-README.md §2 用户裁决 2026-08-27）

任何 gateway-sync 的实现不得违反；与上游行为冲突时，除第 1 条文案语言外，行为保真优先、呈现方式按本约束。

1. **全局默认英文，零 CJK**：全部 UI 文案英文；时间 `en-US` + 24h；金额无千分位（O-6 裁决）；P4 终局扫描用户可见字符串零 CJK。
2. **提示通道唯一 sonner toast**（含登录过期）；确认类二次确认保留 shared AlertDialog；一次性密码展示保留 Dialog+Copy。
3. **登录页铺满视口**：左右分屏铺满、禁内容级 max-w；小屏仅高度向修复。
4. **响应式**：1280×800 主验收口径，六断点逐页验证。
5. **禁止 admin 功能出现**：仅 `libs/shared/ui` 等纯 UI 层可共用；import 审计口径见 P0/P4 留档。
6. **零新增外部依赖**：需要新依赖必须先问用户。

## 英文术语表（上游中文 → 固定英文，保持全站一致）

| 上游中文 | 英文 |
|---|---|
| 待审核 / 已驳回 | Pending Review / Rejected |
| 入网 / 登记 | Onboard / Registered |
| 查询 / 重置 | Search / Reset |
| 已是最新 / 已同步 N 条 | Up to date / Synced N items |
| 功能将在后续版本开放 | Coming soon |
| 本行自转 / 自转 | Self-Trade |

新术语首次翻译时定稿并回填本表（与 LP/gateway 两表保持一致，冲突时以先定稿者为准并在此标注）。
