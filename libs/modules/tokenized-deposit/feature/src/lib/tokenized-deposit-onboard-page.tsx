'use client';

import * as React from 'react';
import { TokenizedDepositFormContent } from './tokenized-deposit-form-content';

/**
 * TokenizedDepositOnboardPage —— 新建页薄壳（route `/tokenized-deposit/onboard`）。
 *
 * 仅负责以 `mode='add'` 渲染共享表单内核 `TokenizedDepositFormContent`（code 恒
 * undefined）。全部表单逻辑（6 hooks + 8 sections + 2 Modal + 2 AlertDialog）位于
 * `tokenized-deposit-form-content.tsx`，与 EditPage 共用，逻辑零重复。
 *
 * 重写自原 `t_edit.tsx` mock 版（无真实 API / WALLET_ADDRESS_MAP / setTimeout），
 * 改走真实 edit.tsx 逻辑（TanStack Query + useCreateTDApplyMutation）。
 *
 * 与 EditPage（`mode='edit'`）构成两个独立路由/页面，满足「add/edit 分开、不在同页
 * 用 query.code 切换」。
 */
export function TokenizedDepositOnboardPage(): React.JSX.Element {
  return <TokenizedDepositFormContent mode="add" />;
}
