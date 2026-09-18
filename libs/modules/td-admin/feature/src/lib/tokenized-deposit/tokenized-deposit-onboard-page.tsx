'use client';

import * as React from 'react';
import { TokenizedDepositAddForm } from './tokenized-deposit-add-form';

/**
 * TokenizedDepositOnboardPage —— 新建页薄壳（route `/tokenized-deposit/onboard`）。
 *
 * 渲染独立的 add 向导组件 `TokenizedDepositAddForm`（向导布局 + 草稿/步骤/Reset）。
 * 表单接线共享 `useTokenizedDepositForm`（mode='add'），与 EditPage 的渲染层彻底分离。
 */
export function TokenizedDepositOnboardPage(): React.JSX.Element {
  return <TokenizedDepositAddForm />;
}

