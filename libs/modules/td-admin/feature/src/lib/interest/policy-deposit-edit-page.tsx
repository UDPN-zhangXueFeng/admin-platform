/**
 * 存款策略编辑/新建页 — page shell（lazy load content）。
 *
 * 迁移自 td-manage `src/pages/interest/policy/deposit/edit.tsx`（829 行）。
 * interestType=2，支持双计算方式（全额/分段）。
 */
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

const DepositEditContent = dynamic(
  () => import('./policy-deposit-edit-content').then((m) => ({ default: m.DepositEditContent })),
  { ssr: false },
);

export function PolicyDepositEditPage() {
  return <DepositEditContent />;
}
