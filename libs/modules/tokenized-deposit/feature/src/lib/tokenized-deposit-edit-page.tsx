'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { TokenizedDepositEditForm } from './tokenized-deposit-edit-form';

/**
 * TokenizedDepositEditPage —— 编辑页薄壳（route `/tokenized-deposit/edit`）。
 *
 * 从 `query.code` 取记录 code，渲染独立的 edit 堆叠组件 `TokenizedDepositEditForm`。
 * 表单接线共享 `useTokenizedDepositForm`（mode='edit' + code），与 OnboardPage 渲染层彻底分离。
 */
export function TokenizedDepositEditPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? undefined;

  return <TokenizedDepositEditForm code={code} />;
}

