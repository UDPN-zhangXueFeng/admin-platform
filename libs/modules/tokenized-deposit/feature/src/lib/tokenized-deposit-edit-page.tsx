'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { TokenizedDepositFormContent } from './tokenized-deposit-form-content';

/**
 * TokenizedDepositEditPage —— 编辑页薄壳（route `/tokenized-deposit/edit`）。
 *
 * 仅负责从 `query.code` 取记录 code，透传给共享表单内核 `TokenizedDepositFormContent`
 * 的 `mode='edit'`。全部表单逻辑（6 hooks + 8 sections + 2 Modal + 2 AlertDialog）位于
 * `tokenized-deposit-form-content.tsx`，与 OnboardPage 共用，逻辑零重复。
 *
 * 与 OnboardPage（`mode='add'`）构成两个独立路由/页面，满足「add/edit 分开、不在同页
 * 用 query.code 切换」。
 */
export function TokenizedDepositEditPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? undefined;

  return <TokenizedDepositFormContent mode="edit" code={code} />;
}
