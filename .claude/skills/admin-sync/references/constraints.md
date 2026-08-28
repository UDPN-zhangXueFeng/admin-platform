# 锁定约束（kissen-admin 侧，继承 gateway/LP 同套用户裁决 2026-08-27）

admin 未做过六件套迁移立项，约束沿用同套五条口径执行；若用户另有裁决以最新指令为准并回填本文件。

1. **全局默认英文，零 CJK**：全部 UI 文案英文；时间 `en-US` + 24h。
2. **提示通道唯一 sonner toast**；确认类二次确认用 shared AlertDialog；一次性密码展示用 Dialog+Copy。
3. **登录页铺满视口**，不限制宽度。
4. **响应式**：1280×800 主验收口径，全断点逐页校验。
5. **与 LP / gateway 门户功能完全隔离**：跨系统仅 `libs/shared/ui` 等纯 UI 层可共用；admin 业务代码不得进其他模块，反之亦然。
6. **零新增外部依赖**：需要新依赖必须先问用户。

## 英文术语表（上游中文 → 固定英文，保持全站一致）

| 上游中文 | 英文 |
|---|---|
| 待审核 / 已驳回 | Pending Review / Rejected |
| 入网 / 登记 | Onboard / Registered |
| 查询 / 重置 | Search / Reset |
| 已是最新 / 已同步 N 条 | Up to date / Synced N items |
| 功能将在后续版本开放 | Coming soon |
| 重置初始口令 | Reset initial password |
| 今日流水（按币种） | Today's Volume by Currency |
| 货币系统凭证 | Currency System Tx ID |
| 扣款本金 | Deduction Principal |
| 默认分成 / 调整默认分成 | Default Split / Adjust Default Split |
| 恢复为草稿 | Restore to Draft / Restored to draft |
| 一次性密码 | One-time password |
| 操作日志 | Operation Logs |
| 待确认 / 已确认 / 已结算 / 已作废（settle v2.0 状态机 10/20/35/45） | Pending Confirmation / Confirmed / Settled / Voided |
| 已登记（未验证）/ 公钥已推送（可激活）/ 在用 / 已停用（instance） | Registered (Unverified) / Pubkey Pushed (Activatable) / Active / Disabled |
| 月结（默认）等结算周期 | Daily / Weekly / Monthly |
| 水位 | Water level（Low / Normal / Sufficient） |

新术语首次翻译时定稿并回填本表（与 LP/gateway 两表保持一致，冲突时以先定稿者为准并在此标注）。
