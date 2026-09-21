/**
 * TokenizedDepositOverviewPage — 运营总览页装配层。
 *
 * 薄包装：渲染 `OverviewShell`（td-14+td-18+td-19 全接线的主组件，含 query 联动 +
 * 4 Tab 挂载 + 5 Modal 接线 + Disable/Enable/Delete 二次确认）。本层仅作 registry 入口，
 * 不引入额外 state——shell 已自管理 applyList 联动 / Tab 切换 / Modal open state。
 *
 * ## 路由 / registry（arch §3 manifest list pageKey）
 *
 * 被 module-registry（td-24）注册为 `list` 页：路由 `/tokenized-deposit`，
 * 是模块默认落地页（applyList 无数据时 shell 内渲染 Empty + Onboard 按钮）。
 *
 * ## 与 view 页区别
 *
 * - overview（本页）：多 TD 切换条 + 概览卡 + 9 操作按钮 + 4 Tab（铸销/合约/钱包/操作记录）。
 * - view（tokenized-deposit-view-page）：单币种详情 3 Tab（铸销/合约/角色钱包）。
 * 两者共用 MintMeltModal 等组件，但壳结构不同。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { OverviewShell } from './tokenized-deposit-overview/overview-shell';

/**
 * 运营总览页（registry list pageKey 入口）。
 *
 * 用法：
 * ```tsx
 * <TokenizedDepositOverviewPage />
 * ```
 */
export function TokenizedDepositOverviewPage(): React.JSX.Element {
  return <OverviewShell />;
}

export default TokenizedDepositOverviewPage;
